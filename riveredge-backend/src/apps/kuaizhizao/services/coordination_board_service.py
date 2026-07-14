"""
生产协调看板服务

以需求计算(MRP)为枢纽，聚合采购/委外/齐套/排程/下达/生产进度，供管控塔「执行协调」Tab 展示。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger

from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_group import WorkOrderGroup
from apps.kuaizhizao.services.demand_computation_service import (
    DemandComputationService,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_CONFIGURE,
    SOURCE_TYPE_PHANTOM,
)
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.constants import ReviewStatus
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import NotFoundError


def _empty_documents() -> Dict[str, List[Dict[str, Any]]]:
    return {
        "work_orders": [],
        "outsource_work_orders": [],
        "work_order_groups": [],
        "purchase_orders": [],
        "purchase_requisitions": [],
    }


_TERMINAL_WORK_ORDER_STATUSES = frozenset({"completed", "cancelled"})
_CLOSED_SALES_ORDER_STATUSES = frozenset({
    "cancelled", "CANCELLED", "已取消",
    "completed", "COMPLETED", "已完成",
    "finished", "FINISHED", "已出库", "closed", "CLOSED",
})


STAGE_DEFS = [
    ("sales_order", "销售订单"),
    ("bom_check", "BOM校验"),
    ("mrp", "MRP完成"),
    ("purchase_follow", "采购跟进"),
    ("purchase_receipt", "采购入库"),
    ("outsource", "委外发收"),
    ("kitting", "齐套就绪"),
    ("rolling_schedule", "滚动计划"),
    ("scheduling", "排程定日"),
    ("release", "工单下达"),
    ("production", "配料报工入库"),
]


class CoordinationBoardService:
    def __init__(self) -> None:
        self.demand_computation_service = DemandComputationService()
        self.work_order_service = WorkOrderService()

    async def _batch_confirmed_receipt_qty_by_po_item(
        self, tenant_id: int, po_ids: Set[int]
    ) -> Dict[int, float]:
        """已确认采购入库数量，按采购订单明细汇总（兼容直接做入库单、未走收货通知）。"""
        if not po_ids:
            return {}
        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=list(po_ids),
            status="已入库",
            deleted_at__isnull=True,
        ).all()
        if not receipts:
            return {}
        receipt_ids = [r.id for r in receipts]
        receipt_items = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id__in=receipt_ids,
            status="已入库",
        ).all()
        result: Dict[int, float] = {}
        for it in receipt_items:
            poi_id = int(it.purchase_order_item_id)
            result[poi_id] = result.get(poi_id, 0.0) + float(it.receipt_quantity or 0)
        return result

    @staticmethod
    def _calc_po_receipt_status(
        items: List[PurchaseOrderItem],
        confirmed_by_poi: Dict[int, float],
    ) -> Tuple[float, float, bool]:
        ordered_total = 0.0
        recv_total = 0.0
        receipt_done = True
        has_qty = False
        for item in items:
            ord_q = float(item.ordered_quantity or 0)
            if ord_q <= 0:
                continue
            has_qty = True
            poi_recv = max(
                float(item.received_quantity or 0),
                confirmed_by_poi.get(item.id, 0.0),
            )
            ordered_total += ord_q
            recv_total += poi_recv
            if poi_recv < ord_q:
                receipt_done = False
        if not has_qty:
            receipt_done = False
        return ordered_total, recv_total, receipt_done

    async def _resolve_latest_computation(
        self,
        tenant_id: int,
        demand_id: Optional[int],
        planning_computation_id: Optional[int],
    ) -> Optional[DemandComputation]:
        comp = None
        if demand_id:
            comp = (
                await DemandComputation.filter(
                    tenant_id=tenant_id,
                    demand_id=demand_id,
                    computation_status="完成",
                )
                .order_by("-id")
                .first()
            )
        if not comp and planning_computation_id:
            comp = await DemandComputation.get_or_none(
                tenant_id=tenant_id,
                id=planning_computation_id,
                computation_status="完成",
            )
        return comp

    async def _count_incomplete_work_orders_for_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        computation_id: Optional[int],
    ) -> int:
        """统计销售订单下未完工工单（MRP 关联 + 工单直挂 sales_order_id）。"""
        incomplete_ids: Set[int] = set()

        if computation_id:
            docs = await self._load_documents(tenant_id, computation_id)
            for wo in docs["work_orders"]:
                if wo.get("status") not in _TERMINAL_WORK_ORDER_STATUSES:
                    incomplete_ids.add(int(wo["id"]))

        direct_wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
        ).exclude(status__in=list(_TERMINAL_WORK_ORDER_STATUSES)).values_list("id", flat=True)
        incomplete_ids.update(int(wo_id) for wo_id in direct_wos)

        return len(incomplete_ids)

    async def list_active_computations(self, tenant_id: int, limit: int = 20) -> Dict[str, Any]:
        """返回进行中（存在未完工下游工单）的已完成 MRP 列表。"""
        computations = (
            await DemandComputation.filter(
                tenant_id=tenant_id,
                computation_status="完成",
            )
            .order_by("-updated_at")
            .limit(limit * 3)
            .all()
        )

        items: List[Dict[str, Any]] = []
        for comp in computations:
            docs = await self._load_documents(tenant_id, comp.id)
            incomplete = sum(
                1
                for wo in docs["work_orders"]
                if wo.get("status") not in ("completed", "cancelled")
            )
            if incomplete == 0 and not docs["work_orders"] and not docs["outsource_work_orders"]:
                continue

            so_code = await self._resolve_sales_order_code(tenant_id, comp)
            items.append(
                {
                    "id": comp.id,
                    "code": comp.computation_code,
                    "status": comp.computation_status,
                    "demand_id": comp.demand_id,
                    "sales_order_code": so_code,
                    "incomplete_work_orders": incomplete,
                    "updated_at": to_api_isoformat(comp.updated_at),
                }
            )
            if len(items) >= limit:
                break

        if not items and computations:
            comp = computations[0]
            items.append(
                {
                    "id": comp.id,
                    "code": comp.computation_code,
                    "status": comp.computation_status,
                    "demand_id": comp.demand_id,
                    "sales_order_code": await self._resolve_sales_order_code(tenant_id, comp),
                    "incomplete_work_orders": 0,
                    "updated_at": to_api_isoformat(comp.updated_at),
                }
            )

        return {"items": items}

    async def list_active_orders(self, tenant_id: int, limit: int = 20) -> Dict[str, Any]:
        """以销售订单为起点，返回协调进行中的订单列表。"""
        from apps.kuaizhizao.models.demand import Demand
        from apps.kuaizhizao.models.sales_order import SalesOrder

        approved_review_statuses = [
            ReviewStatus.APPROVED.value,
            "APPROVED",
            "审核通过",
            "通过",
            "已通过",
        ]
        scan_limit = min(max(limit * 10, limit), 200)
        orders = (
            await SalesOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                review_status__in=approved_review_statuses,
            )
            .exclude(status__in=list(_CLOSED_SALES_ORDER_STATUSES))
            .order_by("-updated_at")
            .limit(scan_limit)
            .all()
        )

        candidates: List[Dict[str, Any]] = []
        for so in orders:
            demand = await Demand.get_or_none(
                tenant_id=tenant_id,
                source_type="sales_order",
                source_id=so.id,
                deleted_at__isnull=True,
            )
            bom_status, _, _ = await self._check_bom_for_order(
                tenant_id, so.id, demand
            )

            comp = await self._resolve_latest_computation(
                tenant_id,
                demand.id if demand else None,
                so.planning_computation_id,
            )
            incomplete_wo = await self._count_incomplete_work_orders_for_sales_order(
                tenant_id,
                so.id,
                comp.id if comp else None,
            )

            delivery = getattr(so, "delivery_date", None)
            candidates.append(
                {
                    "sales_order_id": so.id,
                    "sales_order_code": so.order_code,
                    "delivery_date": to_api_isoformat(delivery),
                    "computation_id": comp.id if comp else None,
                    "computation_code": comp.computation_code if comp else None,
                    "demand_id": demand.id if demand else None,
                    "bom_status": bom_status,
                    "incomplete_work_orders": incomplete_wo,
                    "updated_at": to_api_isoformat(so.updated_at),
                }
            )

        incomplete_candidates = [row for row in candidates if row["incomplete_work_orders"] > 0]
        incomplete_candidates.sort(
            key=lambda row: (
                -int(row["incomplete_work_orders"]),
                row.get("delivery_date") or "",
            )
        )

        if incomplete_candidates:
            items = incomplete_candidates[:limit]
        elif candidates:
            items = candidates[:limit]
        elif orders:
            so = orders[0]
            demand = await Demand.get_or_none(
                tenant_id=tenant_id,
                source_type="sales_order",
                source_id=so.id,
                deleted_at__isnull=True,
            )
            bom_status, _, _ = await self._check_bom_for_order(tenant_id, so.id, demand)
            comp = await self._resolve_latest_computation(
                tenant_id,
                demand.id if demand else None,
                so.planning_computation_id,
            )
            delivery = getattr(so, "delivery_date", None)
            items = [
                {
                    "sales_order_id": so.id,
                    "sales_order_code": so.order_code,
                    "delivery_date": to_api_isoformat(delivery),
                    "computation_id": comp.id if comp else None,
                    "computation_code": comp.computation_code if comp else None,
                    "demand_id": demand.id if demand else None,
                    "bom_status": bom_status,
                    "incomplete_work_orders": 0,
                    "updated_at": to_api_isoformat(so.updated_at),
                }
            ]
        else:
            items = []

        return {"items": items}

    async def get_pipeline(
        self,
        tenant_id: int,
        computation_id: Optional[int] = None,
        sales_order_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        comp, so_brief, demand = await self._resolve_pipeline_context(
            tenant_id, computation_id, sales_order_id
        )
        if not so_brief and not comp:
            raise NotFoundError("未找到可用的协调订单或需求计算单")

        if comp:
            docs = await self._load_documents(tenant_id, comp.id)
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id, computation_id=comp.id
            ).all()
            exclusions = await self.demand_computation_service._get_already_pushed_exclusions(
                tenant_id, comp.id
            )
            exclusions = await self._expand_po_material_ids_from_docs(
                tenant_id, docs, exclusions
            )
            dynamic_alerts = await self._load_dynamic_monitor_alerts(tenant_id, comp.id)
        else:
            docs = _empty_documents()
            items = []
            exclusions = {}
            dynamic_alerts = []

        wo_ids = [d["id"] for d in docs["work_orders"]]
        sales_order_id = so_brief.get("id") if so_brief else None
        bom_status, bom_summary, bom_blockers, missing_bom_mids = (
            await self._check_bom_for_order_details(tenant_id, sales_order_id, demand)
        )
        order_lines = await self._load_sales_order_lines(tenant_id, sales_order_id, demand)
        stages = self._build_stages(
            comp,
            so_brief,
            bom_status,
            bom_summary,
            bom_blockers,
            missing_bom_mids,
            order_lines,
            items,
            docs,
            exclusions,
            wo_ids,
        )
        if comp:
            stages = await self._enrich_kitting_stage(tenant_id, stages, docs)
        stages = await self._enrich_rolling_schedule_stage(tenant_id, stages, docs)

        computation_payload = (
            {
                "id": comp.id,
                "code": comp.computation_code,
                "status": comp.computation_status,
                "demand_id": comp.demand_id,
            }
            if comp
            else None
        )
        return {
            "computation": computation_payload,
            "sales_order": so_brief,
            "stages": stages,
            "documents": docs,
            "work_order_ids": wo_ids,
            "dynamic_monitor_alerts": dynamic_alerts,
        }

    async def _resolve_pipeline_context(
        self,
        tenant_id: int,
        computation_id: Optional[int],
        sales_order_id: Optional[int],
    ) -> Tuple[Optional[DemandComputation], Optional[Dict[str, Any]], Any]:
        from apps.kuaizhizao.models.demand import Demand
        from apps.kuaizhizao.models.sales_order import SalesOrder

        comp: Optional[DemandComputation] = None
        so_brief: Optional[Dict[str, Any]] = None
        demand = None

        if computation_id:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if comp:
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=comp.demand_id)
                so_brief = await self._resolve_sales_order_brief_from_demand(tenant_id, demand)

        if sales_order_id:
            so = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
            )
            if so:
                delivery = getattr(so, "delivery_date", None)
                so_brief = {
                    "id": so.id,
                    "code": so.order_code,
                    "delivery_date": to_api_isoformat(delivery),
                }
                demand = await Demand.get_or_none(
                    tenant_id=tenant_id,
                    source_type="sales_order",
                    source_id=so.id,
                    deleted_at__isnull=True,
                )
                if not comp and demand:
                    comp = (
                        await DemandComputation.filter(
                            tenant_id=tenant_id,
                            demand_id=demand.id,
                            computation_status="完成",
                        )
                        .order_by("-id")
                        .first()
                    )
                if not comp and so.planning_computation_id:
                    comp = await DemandComputation.get_or_none(
                        tenant_id=tenant_id,
                        id=so.planning_computation_id,
                    )

        if not so_brief and not comp:
            active = await self.list_active_orders(tenant_id, limit=1)
            first = (active.get("items") or [None])[0]
            if first:
                return await self._resolve_pipeline_context(
                    tenant_id,
                    first.get("computation_id"),
                    first.get("sales_order_id"),
                )

        return comp, so_brief, demand

    async def _resolve_computation(
        self,
        tenant_id: int,
        computation_id: Optional[int],
        sales_order_id: Optional[int],
    ) -> Optional[DemandComputation]:
        if computation_id:
            return await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)

        if sales_order_id:
            from apps.kuaizhizao.models.demand import Demand

            demand = await Demand.filter(
                tenant_id=tenant_id,
                source_type="sales_order",
                source_id=sales_order_id,
            ).order_by("-id").first()
            if demand:
                return (
                    await DemandComputation.filter(
                        tenant_id=tenant_id,
                        demand_id=demand.id,
                        computation_status="完成",
                    )
                    .order_by("-id")
                    .first()
                )

        active = await self.list_active_computations(tenant_id, limit=1)
        first = (active.get("items") or [None])[0]
        if first:
            return await DemandComputation.get_or_none(tenant_id=tenant_id, id=first["id"])
        return (
            await DemandComputation.filter(tenant_id=tenant_id)
            .order_by("-updated_at")
            .first()
        )

    async def _load_documents(self, tenant_id: int, computation_id: int) -> Dict[str, List[Dict[str, Any]]]:
        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).all()

        wo_ids: Set[int] = set()
        owo_ids: Set[int] = set()
        po_ids: Set[int] = set()

        for rel in rels:
            if rel.target_type == "work_order":
                wo_ids.add(rel.target_id)
            elif rel.target_type == "outsource_work_order":
                owo_ids.add(rel.target_id)
            elif rel.target_type == "purchase_order":
                po_ids.add(rel.target_id)

        # 兼容：采购单可能仅有 source 字段而无 DocumentRelation
        legacy_pos = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).all()
        for po in legacy_pos:
            po_ids.add(po.id)

        pr_ids: Set[int] = {
            rel.target_id for rel in rels if rel.target_type == "purchase_requisition"
        }
        if pr_ids:
            await self._merge_po_ids_from_requisitions(tenant_id, pr_ids, po_ids)

        work_orders: List[Dict[str, Any]] = []
        for wo_id in wo_ids:
            wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=wo_id, deleted_at__isnull=True
            )
            if wo:
                work_orders.append(
                    {
                        "id": wo.id,
                        "code": wo.code,
                        "status": wo.status,
                        "extra": {
                            "product_name": wo.product_name,
                            "quantity": float(wo.quantity),
                            "planned_start_date": to_api_isoformat(wo.planned_start_date),
                            "planned_end_date": to_api_isoformat(wo.planned_end_date),
                            "completed_quantity": float(wo.completed_quantity or 0),
                        },
                    }
                )

        outsource_work_orders: List[Dict[str, Any]] = []
        for owo_id in owo_ids:
            owo = await OutsourceWorkOrder.get_or_none(
                tenant_id=tenant_id, id=owo_id, deleted_at__isnull=True
            )
            if owo:
                qty = float(owo.quantity or 0)
                issued = float(owo.issued_quantity or 0)
                received = float(owo.received_quantity or 0)
                outsource_work_orders.append(
                    {
                        "id": owo.id,
                        "code": owo.code,
                        "status": owo.status,
                        "extra": {
                            "product_name": owo.product_name,
                            "quantity": qty,
                            "issued_quantity": issued,
                            "received_quantity": received,
                            "issue_done": issued >= qty and qty > 0,
                            "receipt_done": received >= qty and qty > 0,
                        },
                    }
                )

        confirmed_receipt_qty = await self._batch_confirmed_receipt_qty_by_po_item(
            tenant_id, po_ids
        )

        purchase_orders: List[Dict[str, Any]] = []
        for po_id in po_ids:
            po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=po_id)
            if po:
                items = await PurchaseOrderItem.filter(order_id=po_id).all()
                ordered, recv, receipt_done = self._calc_po_receipt_status(
                    items, confirmed_receipt_qty
                )
                purchase_orders.append(
                    {
                        "id": po.id,
                        "code": po.order_code,
                        "status": po.status,
                        "extra": {
                            "supplier_name": po.supplier_name,
                            "total_quantity": ordered,
                            "received_quantity": recv,
                            "receipt_done": receipt_done,
                        },
                    }
                )

        purchase_requisitions: List[Dict[str, Any]] = []
        for rel in rels:
            if rel.target_type != "purchase_requisition":
                continue
            from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition

            req = await PurchaseRequisition.get_or_none(
                tenant_id=tenant_id, id=rel.target_id, deleted_at__isnull=True
            )
            if req:
                purchase_requisitions.append(
                    {
                        "id": req.id,
                        "code": req.requisition_code,
                        "status": req.status,
                        "extra": {},
                    }
                )

        work_order_groups: List[Dict[str, Any]] = []
        groups = await WorkOrderGroup.filter(
            tenant_id=tenant_id,
            demand_computation_id=computation_id,
            deleted_at__isnull=True,
        ).all()
        for g in groups:
            work_order_groups.append(
                {
                    "id": g.id,
                    "code": g.group_code,
                    "status": g.status,
                    "extra": {
                        "root_material_name": g.root_material_name,
                        "member_count": g.member_count,
                        "has_direct_supply": bool(g.has_direct_supply),
                    },
                }
            )

        return {
            "work_orders": work_orders,
            "outsource_work_orders": outsource_work_orders,
            "work_order_groups": work_order_groups,
            "purchase_orders": purchase_orders,
            "purchase_requisitions": purchase_requisitions,
        }

    def _build_stages(
        self,
        comp: Optional[DemandComputation],
        so_brief: Optional[Dict[str, Any]],
        bom_status: str,
        bom_summary: str,
        bom_blockers: List[str],
        missing_bom_material_ids: List[int],
        order_lines: List[Dict[str, Any]],
        items: List[DemandComputationItem],
        docs: Dict[str, List[Dict[str, Any]]],
        exclusions: Dict[str, Any],
        wo_ids: List[int],
    ) -> List[Dict[str, Any]]:
        cid = comp.id if comp else None
        so_id = so_brief.get("id") if so_brief else None
        stages: List[Dict[str, Any]] = []
        bom_ready = bom_status in ("done", "skipped")

        if order_lines:
            so_status, so_summary = "done", f"共 {len(order_lines)} 行商品明细"
        else:
            so_status, so_summary = "pending", "暂无订单明细，请完善销售订单"

        stages.append(
            self._stage(
                "sales_order",
                "销售订单",
                so_status,
                so_summary,
                [],
                [
                    self._nav(
                        "查看销售订单",
                        "/apps/kuaizhizao/sales-management/sales-orders",
                    ),
                ]
                if so_id
                else [],
                lines=order_lines,
            )
        )

        first_missing_mid = missing_bom_material_ids[0] if missing_bom_material_ids else None
        product_mid = order_lines[0]["material_id"] if order_lines else None
        bom_actions: List[Dict[str, Any]] = []
        if product_mid:
            bom_actions.append(
                self._nav(
                    "查看 BOM",
                    f"/apps/master-data/process/engineering-bom/designer?materialId={product_mid}",
                )
            )
        elif first_missing_mid:
            bom_actions.append(
                self._nav(
                    "维护 BOM",
                    f"/apps/master-data/process/engineering-bom/designer?materialId={first_missing_mid}",
                ),
            )
        if bom_status not in ("done", "skipped"):
            bom_actions.append(
                self._nav(
                    "查看销售订单",
                    "/apps/kuaizhizao/sales-management/sales-orders",
                ),
            )

        stages.append(
            self._stage(
                "bom_check",
                "BOM校验",
                bom_status,
                bom_summary,
                bom_blockers,
                bom_actions,
            )
        )

        # 2 MRP — BOM 就绪后才可进入需求计算
        if not bom_ready:
            mrp_status, mrp_summary, mrp_blockers = (
                "blocked",
                "请先完成 BOM 校验",
                bom_blockers[:3] or ["成品/半成品缺少已审核 BOM"],
            )
            mrp_actions = []
        elif not comp:
            mrp_status, mrp_summary, mrp_blockers = (
                "pending",
                "BOM 已就绪，待下推需求计算",
                [],
            )
            mrp_actions = [
                self._nav(
                    "下推需求计算",
                    "/apps/kuaizhizao/sales-management/sales-orders",
                ),
            ]
        else:
            mrp_done = comp.computation_status == "完成"
            mrp_status = "done" if mrp_done else "blocked"
            mrp_summary = f"计算单 {comp.computation_code} · {comp.computation_status}"
            mrp_blockers = [] if mrp_done else ["需求计算尚未完成"]
            mrp_actions = [
                self._nav(
                    "查看需求计算",
                    f"/apps/kuaizhizao/plan-management/demand-computation?computationId={cid}",
                ),
            ]

        stages.append(
            self._stage(
                "mrp",
                "MRP完成",
                mrp_status,
                mrp_summary,
                mrp_blockers,
                mrp_actions,
            )
        )

        mrp_ready = comp is not None and comp.computation_status == "完成" and bom_ready
        if not mrp_ready:
            stages.extend(
                self._build_downstream_stages_skipped(
                    "需先完成 BOM 校验与需求计算"
                )
            )
            return stages

        # Buy items analysis
        buy_items = [
            i
            for i in items
            if i.material_source_type == SOURCE_TYPE_BUY
            and float(i.suggested_purchase_order_quantity or 0) > 0
        ]
        po_material_ids: Set[int] = exclusions.get("po_material_ids") or set()
        unpushed_buy = [
            i
            for i in buy_items
            if i.material_id not in po_material_ids
        ]
        no_supplier = [
            i
            for i in unpushed_buy
            if not resolve_computation_item_source_config(i.material_source_config).get(
                "default_supplier_id"
            )
        ]

        wo_count = len(docs["work_orders"])
        owo_count = len(docs["outsource_work_orders"])
        po_count = len(docs["purchase_orders"])
        pr_count = len(docs.get("purchase_requisitions") or [])

        # 2 purchase follow
        if not buy_items:
            pf_status, pf_summary, pf_blockers = "skipped", "无需采购下推", []
        elif not unpushed_buy:
            pf_status, pf_summary, pf_blockers = (
                "done",
                f"采购已下推 PO×{po_count}" + (f" / 申请×{pr_count}" if pr_count else ""),
                [],
            )
        elif pr_count > 0 and po_count == 0:
            pf_status = "partial"
            pf_summary = f"已下推采购申请×{pr_count}，待转 PO / 补下推 {len(unpushed_buy)} 种"
            pf_blockers = [f"{i.material_code} 待转采购订单" for i in unpushed_buy[:5]]
        elif pr_count > 0 and po_count > 0 and unpushed_buy:
            pf_status = "partial"
            pf_summary = (
                f"采购申请×{pr_count} · 采购单×{po_count}，"
                f"待补 {len(unpushed_buy)} 种"
            )
            pf_blockers = [f"{i.material_code} 待转采购订单" for i in unpushed_buy[:5]]
        elif no_supplier:
            pf_status = "blocked"
            pf_summary = f"待下推 {len(unpushed_buy)} 种采购物料"
            pf_blockers = [f"{i.material_code} 未配置默认供应商" for i in no_supplier[:5]]
        elif len(unpushed_buy) < len(buy_items):
            pf_status = "partial"
            pf_summary = f"已下推 PO×{po_count}，待补 {len(unpushed_buy)} 种"
            pf_blockers = [f"{i.material_code} 未下推采购" for i in unpushed_buy[:5]]
        else:
            pf_status = "pending"
            pf_summary = f"待下推 {len(unpushed_buy)} 种采购物料"
            pf_blockers = [f"{i.material_code} 未下推采购" for i in unpushed_buy[:5]]

        pr_list = docs.get("purchase_requisitions") or []
        if pr_count > 0 and unpushed_buy:
            first_pr = pr_list[0] if pr_list else None
            push_purchase_action = self._nav(
                "下推采购单",
                (
                    f"/apps/kuaizhizao/purchase-management/purchase-requisitions"
                    f"?requisitionId={first_pr['id']}&action=pushPO"
                    if first_pr
                    else "/apps/kuaizhizao/purchase-management/purchase-requisitions"
                ),
            )
        elif unpushed_buy:
            push_purchase_action = self._nav(
                "补下推采购",
                f"/apps/kuaizhizao/plan-management/demand-computation?computationId={cid}&action=pushPurchase",
            )
        else:
            if pr_count > 0:
                first_pr = pr_list[0] if pr_list else None
                push_purchase_action = self._nav(
                    "采购申请",
                    (
                        f"/apps/kuaizhizao/purchase-management/purchase-requisitions"
                        f"?requisitionId={first_pr['id']}"
                        if first_pr
                        else "/apps/kuaizhizao/purchase-management/purchase-requisitions"
                    ),
                )
            else:
                push_purchase_action = self._nav(
                    "采购订单",
                    "/apps/kuaizhizao/purchase-management/purchase-orders",
                )

        purchase_follow_actions = [push_purchase_action]
        po_nav = self._nav(
            "采购订单",
            "/apps/kuaizhizao/purchase-management/purchase-orders",
        )
        if push_purchase_action["label"] != po_nav["label"]:
            purchase_follow_actions.append(po_nav)

        stages.append(
            self._stage(
                "purchase_follow",
                "采购跟进",
                pf_status,
                pf_summary,
                pf_blockers,
                purchase_follow_actions if pf_status != "skipped" else [],
            )
        )

        # 3 purchase receipt
        pos = docs["purchase_orders"]
        if not pos:
            pr_status, pr_summary, pr_blockers = "skipped", "无关联采购单", []
        else:
            not_received = [p for p in pos if not (p.get("extra") or {}).get("receipt_done")]
            if not not_received:
                pr_status, pr_summary, pr_blockers = "done", f"采购入库完成 PO×{len(pos)}", []
            elif len(not_received) < len(pos):
                pr_status = "partial"
                pr_summary = f"部分入库 {len(pos) - len(not_received)}/{len(pos)}"
                pr_blockers = [f"{p['code']} 待入库" for p in not_received[:5]]
            else:
                pr_status = "pending"
                pr_summary = f"待采购入库 PO×{len(not_received)}"
                pr_blockers = [f"{p['code']} 待入库" for p in not_received[:5]]

        stages.append(
            self._stage(
                "purchase_receipt",
                "采购入库",
                pr_status,
                pr_summary,
                pr_blockers,
                [
                    self._nav(
                        "采购入库",
                        "/apps/kuaizhizao/warehouse-management/inbound",
                    ),
                ]
                if pr_status not in ("skipped", "done")
                else [],
            )
        )

        # 4 outsource
        owos = docs["outsource_work_orders"]
        if not owos:
            os_status, os_summary, os_blockers = "skipped", "无委外工单", []
            os_actions: List[Dict[str, Any]] = []
        else:
            pending_issue = [
                o
                for o in owos
                if o["status"] in ("draft", "released", "in_progress")
                and not (o.get("extra") or {}).get("issue_done")
            ]
            pending_receipt = [
                o
                for o in owos
                if o["status"] in ("released", "in_progress")
                and (o.get("extra") or {}).get("issue_done")
                and not (o.get("extra") or {}).get("receipt_done")
            ]
            done_count = sum(1 for o in owos if (o.get("extra") or {}).get("receipt_done"))
            if done_count == len(owos):
                os_status, os_summary, os_blockers = "done", f"委外发收完成 OWO×{len(owos)}", []
            elif pending_issue:
                os_status = "partial" if done_count else "pending"
                os_summary = f"待委外发料 {len(pending_issue)} 单"
                os_blockers = [f"{o['code']} 待发料" for o in pending_issue[:5]]
            elif pending_receipt:
                os_status = "partial"
                os_summary = f"待委外收货 {len(pending_receipt)} 单"
                os_blockers = [f"{o['code']} 待收货" for o in pending_receipt[:5]]
            else:
                os_status = "partial"
                os_summary = f"委外进行中 OWO×{len(owos)}"
                os_blockers = []
            os_actions = [
                self._nav(
                    "委外发料",
                    "/apps/kuaizhizao/warehouse-management/batching-center?tab=outsource_issue",
                ),
                self._nav(
                    "委外收货",
                    "/apps/kuaizhizao/warehouse-management/batching-center?tab=outsource_receipt",
                ),
            ]

        stages.append(
            self._stage("outsource", "委外发收", os_status, os_summary, os_blockers, os_actions)
        )

        # 5 kitting — simplified: use readiness from draft WOs
        draft_wos = [w for w in docs["work_orders"] if w["status"] == "draft"]
        if not docs["work_orders"]:
            kit_status, kit_summary, kit_blockers = "pending", "尚无生产工单", ["请先下推生产工单"]
        elif not draft_wos:
            kit_status, kit_summary, kit_blockers = "done", "无待齐套草稿工单", []
        else:
            kit_status = "partial"
            kit_summary = f"待齐套草稿工单 {len(draft_wos)} 个"
            kit_blockers = [f"{w['code']} 待齐套分析" for w in draft_wos[:5]]

        stages.append(
            self._stage(
                "kitting",
                "齐套就绪",
                kit_status,
                kit_summary,
                kit_blockers,
                [
                    {"type": "refresh", "label": "刷新齐套", "route": None},
                    {"type": "release_kitted", "label": "齐套下达", "route": None},
                ]
                if draft_wos
                else [self._nav("工单列表", "/apps/kuaizhizao/production-execution/work-orders")],
            )
        )

        active_wos = [
            w
            for w in docs["work_orders"]
            if w["status"] not in ("completed", "cancelled")
        ]

        stages.append(
            self._stage(
                "rolling_schedule",
                "滚动计划",
                "pending" if active_wos else "skipped",
                "检查明日日计划…" if active_wos else "无待派工工单",
                [],
                [],
            )
        )

        # 7 scheduling
        if not active_wos:
            sch_status, sch_summary, sch_blockers = "skipped", "无待排程工单", []
        else:
            no_date = [
                w
                for w in active_wos
                if not (w.get("extra") or {}).get("planned_start_date")
            ]
            if not no_date:
                sch_status, sch_summary, sch_blockers = "done", f"计划日已设定 WO×{len(active_wos)}", []
            elif len(no_date) < len(active_wos):
                sch_status = "partial"
                sch_summary = f"部分未排程 {len(no_date)}/{len(active_wos)}"
                sch_blockers = [f"{w['code']} 缺计划开工日" for w in no_date[:5]]
            else:
                sch_status = "pending"
                sch_summary = f"待排程 WO×{len(no_date)}"
                sch_blockers = [f"{w['code']} 缺计划开工日" for w in no_date[:5]]

        wo_query = ",".join(str(i) for i in wo_ids) if wo_ids else ""
        next_workday_placeholder = to_api_isoformat(date.today() + timedelta(days=1))
        stages.append(
            self._stage(
                "scheduling",
                "排程定日",
                sch_status,
                sch_summary,
                sch_blockers,
                [
                    self._nav(
                        "去排程",
                        f"/apps/kuaizhizao/plan-management/scheduling?work_order_ids={wo_query}&plan_date={next_workday_placeholder}",
                    ),
                ]
                if sch_status not in ("skipped", "done")
                else [],
            )
        )

        # 7 release
        if not docs["work_orders"]:
            rel_status, rel_summary, rel_blockers = "pending", "尚无生产工单", []
        else:
            still_draft = [w for w in docs["work_orders"] if w["status"] == "draft"]
            released = [
                w
                for w in docs["work_orders"]
                if w["status"] in ("released", "in_progress", "completed")
            ]
            if not still_draft:
                rel_status, rel_summary, rel_blockers = (
                    "done",
                    f"工单已下达/完工 {len(released)} 个",
                    [],
                )
            else:
                rel_status = "partial" if released else "pending"
                rel_summary = f"待下达草稿 {len(still_draft)} 个"
                rel_blockers = [f"{w['code']} 草稿待下达" for w in still_draft[:5]]

        stages.append(
            self._stage(
                "release",
                "工单下达",
                rel_status,
                rel_summary,
                rel_blockers,
                [
                    {"type": "release_kitted", "label": "齐套下达", "route": None},
                    self._nav("工单列表", "/apps/kuaizhizao/production-execution/work-orders"),
                ]
                if rel_status != "done"
                else [],
            )
        )

        # 8 production
        if not docs["work_orders"]:
            prod_status, prod_summary, prod_blockers = "pending", "尚无生产工单", []
        else:
            completed = [w for w in docs["work_orders"] if w["status"] == "completed"]
            in_prog = [w for w in docs["work_orders"] if w["status"] in ("released", "in_progress")]
            if len(completed) == len(docs["work_orders"]):
                prod_status, prod_summary, prod_blockers = (
                    "done",
                    f"全部完工 WO×{len(completed)}",
                    [],
                )
            elif in_prog or completed:
                prod_status = "partial"
                prod_summary = f"生产中 {len(in_prog)} · 已完工 {len(completed)}"
                prod_blockers = [f"{w['code']} 待报工入库" for w in in_prog[:5]]
            else:
                prod_status = "pending"
                prod_summary = "待配料报工"
                prod_blockers = ["工单尚未进入生产执行"]

        stages.append(
            self._stage(
                "production",
                "配料报工入库",
                prod_status,
                prod_summary,
                prod_blockers,
                [
                    self._nav(
                        "物料中心配料",
                        "/apps/kuaizhizao/warehouse-management/batching-center",
                    ),
                    self._nav(
                        "报工看板",
                        "/apps/kuaizhizao/production-execution/dashboard",
                    ),
                ]
                if prod_status != "done"
                else [],
            )
        )

        return stages

    def _build_downstream_stages_skipped(self, reason: str) -> List[Dict[str, Any]]:
        """MRP 未就绪时，下游阶段统一标记为跳过。"""
        skipped_defs = [
            ("purchase_follow", "采购跟进"),
            ("purchase_receipt", "采购入库"),
            ("outsource", "委外发收"),
            ("kitting", "齐套就绪"),
            ("rolling_schedule", "滚动计划"),
            ("scheduling", "排程定日"),
            ("release", "工单下达"),
            ("production", "配料报工入库"),
        ]
        return [
            self._stage(key, title, "skipped", reason, [], [])
            for key, title in skipped_defs
        ]

    async def _enrich_rolling_schedule_stage(
        self,
        tenant_id: int,
        stages: List[Dict[str, Any]],
        docs: Dict[str, List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """刷新滚动计划阶段：明日是否已发布日计划。"""
        from apps.kuaizhizao.services.rolling_schedule_service import RollingScheduleService

        active_wos = [
            w for w in docs["work_orders"] if w["status"] not in ("completed", "cancelled")
        ]
        rolling_svc = RollingScheduleService()
        next_workday = await rolling_svc.get_next_workday(tenant_id, date.today())
        next_plan = await rolling_svc.get_plan_by_date(tenant_id, next_workday)

        for stage in stages:
            if stage["key"] != "rolling_schedule":
                continue
            if not active_wos:
                stage["status"] = "skipped"
                stage["summary"] = "无待派工工单"
                stage["blockers"] = []
                stage["actions"] = []
                break
            if next_plan and next_plan.status == "published":
                stage["status"] = "done"
                stage["summary"] = f"明日 {next_workday} 日计划已发布（{len(next_plan.lines)} 单）"
                stage["blockers"] = []
            elif next_plan and next_plan.status == "draft":
                stage["status"] = "partial"
                stage["summary"] = f"明日 {next_workday} 日计划草稿待发布"
                stage["blockers"] = ["滚动计划尚未发布"]
            else:
                stage["status"] = "pending"
                stage["summary"] = f"明日 {next_workday} 未发布日计划"
                stage["blockers"] = ["请至滚动计划生成并发布次日计划"]
            stage["actions"] = [
                self._nav(
                    "去滚动计划",
                    f"/apps/kuaizhizao/plan-management/rolling-scheduling?plan_date={to_api_isoformat(next_workday)}",
                ),
            ]
            break

        for stage in stages:
            if stage["key"] != "scheduling":
                continue
            for action in stage.get("actions") or []:
                route = action.get("route") or ""
                if action.get("type") == "nav" and "plan_date=" in route:
                    base = route.split("&plan_date=")[0]
                    action["route"] = f"{base}&plan_date={to_api_isoformat(next_workday)}"
            break

        return stages

    async def _enrich_kitting_stage(
        self,
        tenant_id: int,
        stages: List[Dict[str, Any]],
        docs: Dict[str, List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """用齐套分析 API 精确刷新 kitting 阶段状态。"""
        draft_wos = [w for w in docs["work_orders"] if w["status"] == "draft"]
        if not draft_wos:
            return stages

        fully = 0
        not_kitted: List[str] = []
        for w in draft_wos:
            try:
                analysis = await self.work_order_service.get_work_order_kitting_analysis(
                    tenant_id, w["id"]
                )
                if analysis.status == "fully_kitted":
                    fully += 1
                else:
                    not_kitted.append(f"{w['code']} 齐套不足")
            except Exception:
                not_kitted.append(f"{w['code']} 齐套分析失败")

        for stage in stages:
            if stage["key"] != "kitting":
                continue
            if fully == len(draft_wos):
                stage["status"] = "done"
                stage["summary"] = f"草稿工单全部齐套 {fully} 个"
                stage["blockers"] = []
            elif fully > 0:
                stage["status"] = "partial"
                stage["summary"] = f"已齐套 {fully}/{len(draft_wos)} 个草稿工单"
                stage["blockers"] = not_kitted[:5]
            else:
                stage["status"] = "pending"
                stage["summary"] = f"待齐套草稿工单 {len(draft_wos)} 个"
                stage["blockers"] = not_kitted[:5]
            break
        return stages

    def _stage(
        self,
        key: str,
        title: str,
        status: str,
        summary: str,
        blockers: List[str],
        actions: List[Dict[str, Any]],
        lines: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        return {
            "key": key,
            "title": title,
            "status": status,
            "summary": summary,
            "blockers": blockers,
            "actions": actions,
            "lines": lines or [],
        }

    @staticmethod
    def _nav(label: str, route: str) -> Dict[str, Any]:
        return {"type": "navigate", "label": label, "route": route}

    async def _merge_po_ids_from_requisitions(
        self,
        tenant_id: int,
        requisition_ids: Set[int],
        po_ids: Set[int],
    ) -> None:
        """采购申请转 PO 时通常只关联 PR，需反向追溯纳入协调看板。"""
        if not requisition_ids:
            return

        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem

        pr_id_list = list(requisition_ids)

        source_pos = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            source_type="PurchaseRequisition",
            source_id__in=pr_id_list,
        ).all()
        for po in source_pos:
            po_ids.add(po.id)

        converted_lines = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id__in=pr_id_list,
            purchase_order_id__isnull=False,
        ).all()
        for line in converted_lines:
            if line.purchase_order_id:
                po_ids.add(line.purchase_order_id)

        pr_po_rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="purchase_requisition",
            source_id__in=pr_id_list,
            target_type="purchase_order",
        ).all()
        for rel in pr_po_rels:
            po_ids.add(rel.target_id)

    async def _expand_po_material_ids_from_docs(
        self,
        tenant_id: int,
        docs: Dict[str, List[Dict[str, Any]]],
        exclusions: Dict[str, Any],
    ) -> Dict[str, Any]:
        """将已加载采购单（含 PR 转单）的物料并入已下推集合。"""
        po_material_ids: Set[int] = set(exclusions.get("po_material_ids") or set())
        for po in docs.get("purchase_orders") or []:
            po_id = po.get("id")
            if not po_id:
                continue
            items = await PurchaseOrderItem.filter(order_id=po_id).all()
            for poi in items:
                if poi.material_id:
                    po_material_ids.add(poi.material_id)
        return {**exclusions, "po_material_ids": po_material_ids}

    async def _load_sales_order_lines(
        self,
        tenant_id: int,
        sales_order_id: Optional[int],
        demand: Any,
    ) -> List[Dict[str, Any]]:
        """加载销售订单行：编号/名称/规格/数量/交期 + 当前可用库存。"""
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.kuaizhizao.utils.inventory_helper import batch_get_material_inventory

        lines: List[Dict[str, Any]] = []

        if demand:
            demand_items = await DemandItem.filter(
                tenant_id=tenant_id, demand_id=demand.id
            ).all()
            for item in demand_items:
                qty = float(item.required_quantity or 0)
                if qty <= 0:
                    continue
                dd = item.delivery_date
                lines.append(
                    {
                        "material_id": item.material_id,
                        "material_code": item.material_code or "",
                        "material_name": item.material_name or "",
                        "material_spec": item.material_spec,
                        "unit": item.material_unit or "",
                        "quantity": qty,
                        "delivery_date": to_api_isoformat(dd),
                    }
                )

        if not lines and sales_order_id:
            so_items = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
            ).all()
            for item in so_items:
                qty = float(item.order_quantity or 0)
                if qty <= 0:
                    continue
                dd = item.delivery_date
                lines.append(
                    {
                        "material_id": item.material_id,
                        "material_code": item.material_code or "",
                        "material_name": item.material_name or "",
                        "material_spec": item.material_spec,
                        "unit": item.material_unit or "",
                        "quantity": qty,
                        "delivery_date": to_api_isoformat(dd),
                    }
                )

        if not lines:
            return []

        material_ids = [line["material_id"] for line in lines]
        inventory_map = await batch_get_material_inventory(tenant_id, material_ids)
        for line in lines:
            line["available_quantity"] = float(
                inventory_map.get(line["material_id"], 0)
            )
        return lines

    async def _resolve_sales_order_code(
        self, tenant_id: int, comp: DemandComputation
    ) -> Optional[str]:
        brief = await self._resolve_sales_order_brief(tenant_id, comp)
        return brief.get("code") if brief else None

    async def _resolve_sales_order_brief(
        self, tenant_id: int, comp: DemandComputation
    ) -> Optional[Dict[str, Any]]:
        from apps.kuaizhizao.models.demand import Demand

        demand = await Demand.get_or_none(tenant_id=tenant_id, id=comp.demand_id)
        return await self._resolve_sales_order_brief_from_demand(tenant_id, demand)

    async def _resolve_sales_order_brief_from_demand(
        self, tenant_id: int, demand: Any
    ) -> Optional[Dict[str, Any]]:
        from apps.kuaizhizao.models.sales_order import SalesOrder

        if not demand or demand.source_type != "sales_order":
            return None
        so = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
        if not so:
            return {"id": demand.source_id, "code": demand.source_code, "delivery_date": None}
        delivery = getattr(so, "delivery_date", None) or getattr(so, "required_date", None)
        return {
            "id": so.id,
            "code": so.order_code,
            "delivery_date": to_api_isoformat(delivery),
        }

    async def _get_order_line_materials(
        self,
        tenant_id: int,
        sales_order_id: Optional[int],
        demand: Any,
    ) -> List[Tuple[int, str, str]]:
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        rows: List[Tuple[int, str, str]] = []
        if demand:
            demand_items = await DemandItem.filter(
                tenant_id=tenant_id, demand_id=demand.id
            ).all()
            for item in demand_items:
                if float(item.required_quantity or 0) > 0:
                    rows.append(
                        (item.material_id, item.material_code or "", item.material_name or "")
                    )
            return rows

        if not sales_order_id:
            return rows

        so_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        ).all()
        for item in so_items:
            qty = float(item.order_quantity or 0)
            if qty > 0:
                rows.append(
                    (item.material_id, item.material_code or "", item.material_name or "")
                )
        return rows

    async def _check_bom_for_order(
        self,
        tenant_id: int,
        sales_order_id: Optional[int],
        demand: Any,
    ) -> Tuple[str, str, List[str]]:
        status, summary, blockers, _ = await self._check_bom_for_order_details(
            tenant_id, sales_order_id, demand
        )
        return status, summary, blockers

    async def _check_bom_for_order_details(
        self,
        tenant_id: int,
        sales_order_id: Optional[int],
        demand: Any,
    ) -> Tuple[str, str, List[str], List[int]]:
        from apps.kuaizhizao.utils.material_source_helper import (
            get_material_source_type,
            resolve_computation_item_source_config,
        )
        from apps.master_data.services.material_service import MaterialService

        lines = await self._get_order_line_materials(tenant_id, sales_order_id, demand)
        if not lines:
            return "pending", "订单尚无明细", ["请完善销售订单明细"], []

        need_check: List[Tuple[int, str]] = []
        for material_id, material_code, material_name in lines:
            source_type = await get_material_source_type(tenant_id, material_id)
            if source_type in (SOURCE_TYPE_BUY, None):
                continue
            label = material_code or material_name or str(material_id)
            need_check.append((material_id, label))

        if not need_check:
            return "skipped", "外购件订单，无需 BOM", [], []

        material_ids = [mid for mid, _ in need_check]
        bom_map = await MaterialService.batch_check_has_bom(
            tenant_id=tenant_id,
            material_ids=material_ids,
            only_active=True,
        )
        missing = [(mid, code) for mid, code in need_check if not bom_map.get(mid, False)]
        blockers = [f"{code} 缺少已审核 BOM" for _, code in missing[:5]]
        ready_count = len(need_check) - len(missing)

        if not missing:
            return (
                "done",
                f"已校验 {len(need_check)} 个成品/半成品 BOM",
                [],
                [],
            )
        if ready_count > 0:
            return (
                "partial",
                f"BOM 就绪 {ready_count}/{len(need_check)}",
                blockers,
                [mid for mid, _ in missing],
            )
        return (
            "blocked",
            f"{len(missing)} 个物料缺少 BOM",
            blockers,
            [mid for mid, _ in missing],
        )

    async def _load_dynamic_monitor_alerts(
        self, tenant_id: int, computation_id: int
    ) -> List[str]:
        try:
            monitor = await self.demand_computation_service.get_computation_dynamic_monitor(
                tenant_id, computation_id
            )
            alerts: List[str] = []
            for item in monitor.get("upstream_alerts") or []:
                alerts.append(item.get("message") or str(item))
            for item in monitor.get("downstream_alerts") or []:
                alerts.append(item.get("message") or str(item))
            if monitor.get("has_upstream_change") and not any("上游" in a for a in alerts):
                alerts.insert(0, "上游需求或 BOM 发生变更，建议重新核算 MRP")
            return alerts[:5]
        except Exception as e:
            logger.debug(f"dynamic monitor skipped: {e}")
            return []
