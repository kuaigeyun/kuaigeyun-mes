"""工单物料移动 / 物料履历查询：优先流水表，无流水时单据并集兜底；履历另拼采购供给链路事件。"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Set, Tuple

from apps.kuaizhizao.models.backflush_record import BackflushRecord
from apps.kuaizhizao.models.batching_order import BatchingOrder, BatchingOrderItem
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
from apps.kuaizhizao.models.material_call_request_item import MaterialCallRequestItem
from apps.kuaizhizao.models.material_stock_movement import MaterialStockMovement
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
from apps.kuaizhizao.models.receipt_notice_item import ReceiptNoticeItem
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.material_stock_movement import (
    WorkOrderMaterialHistoryMaterial,
    WorkOrderMaterialMovementItem,
    WorkOrderMaterialMovementListResponse,
)
from apps.kuaizhizao.utils.picking_posting import is_staging_transfer_picking_notes
from core.utils.timezone_utils import to_naive_utc
from infra.exceptions.exceptions import NotFoundError

# 采购供给链路阶段序（时间相同时稳定业务语义：申请→订单→通知→检验→入库）
_PROCUREMENT_STAGE_ORDER = {
    "purchase_requisition": 10,
    "purchase_order": 20,
    "receipt_notice": 30,
    "incoming_inspection": 40,
    "purchase_receipt": 50,
}

_PURCHASE_RECEIPT_POSTED = frozenset({"已入库", "已完成", "completed", "已确认"})


def _as_utc_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """履历比较：naive 按 UTC 解释（与 USE_TZ 落库一致）。禁止重解释/纠偏。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _history_sort_key(item: WorkOrderMaterialMovementItem) -> Tuple[datetime, int, int]:
    ts = _as_utc_aware(item.occurred_at) or datetime.min.replace(tzinfo=timezone.utc)
    stage = _PROCUREMENT_STAGE_ORDER.get(str(item.movement_type or ""), 100)
    doc_id = int(item.source_doc_id or item.id or 0)
    return (to_naive_utc(ts), stage, doc_id)


class MaterialStockMovementService:
    async def list_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        limit: int = 200,
    ) -> WorkOrderMaterialMovementListResponse:
        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        ledger_rows = (
            await MaterialStockMovement.filter(
                tenant_id=tenant_id, work_order_id=work_order_id
            )
            .order_by("-created_at", "-id")
            .limit(limit)
            .all()
        )
        if ledger_rows:
            items = [
                WorkOrderMaterialMovementItem(
                    id=r.id,
                    source="ledger",
                    movement_type=r.movement_type,
                    material_id=r.material_id,
                    material_code=r.material_code,
                    batch_no=r.batch_no,
                    quantity=Decimal(str(r.quantity or 0)),
                    qty_before=r.qty_before,
                    qty_after=r.qty_after,
                    from_warehouse_id=r.from_warehouse_id,
                    from_warehouse_name=r.from_warehouse_name,
                    to_warehouse_id=r.to_warehouse_id,
                    to_warehouse_name=r.to_warehouse_name,
                    source_doc_type=r.source_doc_type,
                    source_doc_id=r.source_doc_id,
                    source_doc_code=r.source_doc_code,
                    work_order_id=r.work_order_id,
                    work_order_code=r.work_order_code,
                    operator_id=r.operator_id,
                    operator_name=r.operator_name,
                    remark=r.remark,
                    occurred_at=r.created_at,
                )
                for r in ledger_rows
            ]
            return WorkOrderMaterialMovementListResponse(
                work_order_id=work_order_id,
                total=len(items),
                items=items,
                source_mode="ledger",
            )

        doc_items = await self._document_fallback(tenant_id, wo, limit=limit)
        return WorkOrderMaterialMovementListResponse(
            work_order_id=work_order_id,
            total=len(doc_items),
            items=doc_items,
            source_mode="document",
        )

    async def list_history_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        limit: int = 200,
    ) -> WorkOrderMaterialMovementListResponse:
        """物料履历：仅当前工单 BOM/成品相关物料；采购供给链路 + 库存移动，时间正序。"""
        movements = await self.list_for_work_order(tenant_id, work_order_id, limit=limit)
        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        bom_material_ids = await self._work_order_material_ids(tenant_id, wo)
        wo_material_ids = set(bom_material_ids)
        # 成品入库/报废等挂产品本身（过滤用，不进左栏 BOM 列表）
        if wo.product_id:
            wo_material_ids.add(int(wo.product_id))
        # BOM 失败时，至少用本工单已有移动中的物料收窄
        if not wo_material_ids:
            for m in movements.items:
                if m.material_id:
                    wo_material_ids.add(int(m.material_id))
        catalog_material_ids = bom_material_ids if bom_material_ids else wo_material_ids

        procurement = await self._procurement_events(tenant_id, wo, wo_material_ids)
        movement_items = list(movements.items)
        if wo_material_ids:
            movement_items = [
                m
                for m in movement_items
                if m.material_id is None or int(m.material_id) in wo_material_ids
            ]

        # 自制/委外子件履历在子工单上：合并组内 BOM 子工单的库存移动
        related_movements = await self._related_bom_child_movements(
            tenant_id, wo, wo_material_ids, limit=limit
        )
        if related_movements:
            movement_items.extend(related_movements)

        # 库存移动 occurred_at 也走同一归一化，避免与采购链路混比
        for m in movement_items:
            m.occurred_at = _as_utc_aware(m.occurred_at)

        merged = list(procurement) + movement_items

        def _dedupe_rank(item: WorkOrderMaterialMovementItem) -> int:
            rank = 0
            # 采购链路单据事件优先于同单库存流水，保留状态/操作人
            if item.source == "document" and str(item.movement_type) in _PROCUREMENT_STAGE_ORDER:
                rank += 20
            elif item.source == "ledger":
                rank += 10
            if item.operator_name:
                rank += 2
            if item.remark:
                rank += 1
            return rank

        best: dict[Tuple[str, int, int], WorkOrderMaterialMovementItem] = {}
        passthrough: List[WorkOrderMaterialMovementItem] = []
        for item in merged:
            mid = int(item.material_id or 0)
            doc_id = int(item.source_doc_id or 0)
            doc_type = str(item.source_doc_type or item.movement_type or "")
            if not doc_id or not mid:
                passthrough.append(item)
                continue
            key = (doc_type, doc_id, mid)
            prev = best.get(key)
            if prev is None or _dedupe_rank(item) > _dedupe_rank(prev):
                best[key] = item
        merged = passthrough + list(best.values())
        merged.sort(key=_history_sort_key)
        # 正序后保留最近 N 条，避免砍掉尾部入库/移动
        if len(merged) > limit:
            merged = merged[-limit:]

        source_mode: str = movements.source_mode
        if procurement or related_movements:
            source_mode = "mixed" if movement_items else "document"

        await self._enrich_material_display(tenant_id, merged)
        materials = await self._build_history_materials(
            tenant_id, catalog_material_ids, merged
        )

        return WorkOrderMaterialMovementListResponse(
            work_order_id=work_order_id,
            total=len(merged),
            items=merged,
            materials=materials,
            source_mode=source_mode,  # type: ignore[arg-type]
        )

    async def _related_bom_child_movements(
        self,
        tenant_id: int,
        wo: WorkOrder,
        wo_material_ids: Set[int],
        *,
        limit: int,
    ) -> List[WorkOrderMaterialMovementItem]:
        """合并 BOM 子工单（自制半成品）履历，供父工单物料履历展示。"""
        if not wo.id or not wo_material_ids:
            return []
        child_q = WorkOrder.filter(
            tenant_id=tenant_id,
            bom_parent_work_order_id=int(wo.id),
            deleted_at__isnull=True,
        )
        if wo.work_order_group_id:
            child_q = child_q.filter(work_order_group_id=wo.work_order_group_id)
        children = await child_q.all()
        if not children:
            return []

        out: List[WorkOrderMaterialMovementItem] = []
        for child in children:
            if not child.id:
                continue
            child_resp = await self.list_for_work_order(
                tenant_id, int(child.id), limit=limit
            )
            child_product_id = int(child.product_id) if child.product_id else None
            for m in child_resp.items:
                mid = int(m.material_id) if m.material_id else None
                if mid and mid in wo_material_ids:
                    out.append(m)
                elif (
                    child_product_id
                    and child_product_id in wo_material_ids
                    and (mid is None or mid == child_product_id)
                ):
                    out.append(m)
            if len(out) >= limit:
                break
        return out[:limit]

    async def _build_history_materials(
        self,
        tenant_id: int,
        wo_material_ids: Set[int],
        items: List[WorkOrderMaterialMovementItem],
    ) -> List[WorkOrderMaterialHistoryMaterial]:
        """左栏物料：BOM 全集 + 履历中出现的物料，保证与「库位与补料」物料行对齐。"""
        from apps.master_data.models.material import Material

        ids = set(int(x) for x in wo_material_ids if x)
        for item in items:
            if item.material_id:
                ids.add(int(item.material_id))
        if not ids:
            return []
        mats = await Material.filter(
            tenant_id=tenant_id, id__in=list(ids), deleted_at__isnull=True
        ).all()
        by_id = {int(m.id): m for m in mats}
        result: List[WorkOrderMaterialHistoryMaterial] = []
        for mid in sorted(ids):
            m = by_id.get(mid)
            if m:
                result.append(
                    WorkOrderMaterialHistoryMaterial(
                        material_id=mid,
                        material_code=m.main_code or m.code,
                        material_name=m.name,
                        material_spec=m.specification,
                    )
                )
            else:
                # 主数据缺失时仍占位，避免左栏漏项
                fallback = next(
                    (i for i in items if i.material_id and int(i.material_id) == mid),
                    None,
                )
                result.append(
                    WorkOrderMaterialHistoryMaterial(
                        material_id=mid,
                        material_code=(fallback.material_code if fallback else None) or str(mid),
                        material_name=fallback.material_name if fallback else None,
                        material_spec=fallback.material_spec if fallback else None,
                    )
                )
        result.sort(
            key=lambda x: (str(x.material_code or ""), int(x.material_id)),
        )
        return result

    async def _enrich_material_display(
        self,
        tenant_id: int,
        items: List[WorkOrderMaterialMovementItem],
    ) -> None:
        """补齐物料名称/规格：单据行已有则保留，否则用主数据。"""
        from apps.master_data.models.material import Material

        ids = sorted({int(i.material_id) for i in items if i.material_id})
        if not ids:
            return
        mats = await Material.filter(
            tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
        ).all()
        by_id = {int(m.id): m for m in mats}
        for item in items:
            mid = int(item.material_id or 0)
            m = by_id.get(mid)
            if not m:
                continue
            if not item.material_code:
                item.material_code = m.main_code or m.code
            if not item.material_name:
                item.material_name = m.name
            if not item.material_spec:
                item.material_spec = m.specification

    async def _work_order_material_ids(self, tenant_id: int, wo: WorkOrder) -> Set[int]:
        """工单 BOM 展开后的组件物料 ID 集合。"""
        from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom

        try:
            requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=wo.product_id,
                required_quantity=float(wo.quantity or 0),
                only_approved=True,
                variant_attributes=getattr(wo, "variant_attributes", None),
                configurable_selections=getattr(wo, "configurable_selections", None),
                for_kitting_analysis=True,
            )
        except Exception:
            return set()
        return {
            int(req.component_id)
            for req in (requirements or [])
            if getattr(req, "component_id", None)
        }

    async def _procurement_events(
        self,
        tenant_id: int,
        wo: WorkOrder,
        wo_material_ids: Set[int],
    ) -> List[WorkOrderMaterialMovementItem]:
        """采购供给链路履历：申请→订单→收货通知→来料检验→采购入库（仅工单物料行）。"""
        if not wo_material_ids:
            return []

        computation_ids: Set[int] = set()
        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="work_order",
            target_id=wo.id,
            source_type="demand_computation",
        ).all()
        for rel in rels:
            if rel.source_id:
                computation_ids.add(int(rel.source_id))

        pr_ids: Set[int] = set()
        po_ids: Set[int] = set()
        for cid in computation_ids:
            out_rels = await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=cid,
            ).all()
            for rel in out_rels:
                if rel.target_type == "purchase_requisition":
                    pr_ids.add(int(rel.target_id))
                elif rel.target_type == "purchase_order":
                    po_ids.add(int(rel.target_id))

            legacy_prs = await PurchaseRequisition.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for pr in legacy_prs:
                pr_ids.add(int(pr.id))

            legacy_pos = await PurchaseOrder.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for po in legacy_pos:
                po_ids.add(int(po.id))

        if pr_ids:
            pr_lines = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id,
                requisition_id__in=list(pr_ids),
                material_id__in=list(wo_material_ids),
            ).all()
            for line in pr_lines:
                if line.purchase_order_id:
                    po_ids.add(int(line.purchase_order_id))

        # 无论是否命中需求计算链路，均按工单 BOM 物料补齐申请/订单（避免手工单/旁路缺失）
        await self._append_procurement_ids_from_bom_materials(
            tenant_id, wo_material_ids, pr_ids, po_ids
        )

        items: List[WorkOrderMaterialMovementItem] = []
        material_id_list = list(wo_material_ids)

        for pr_id in pr_ids:
            pr = await PurchaseRequisition.get_or_none(
                tenant_id=tenant_id, id=pr_id, deleted_at__isnull=True
            )
            if not pr:
                continue
            lines = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id,
                requisition_id=pr.id,
                material_id__in=material_id_list,
            ).all()
            occurred = _as_utc_aware(
                getattr(pr, "created_at", None)
                or (
                    datetime.combine(pr.requisition_date, datetime.min.time())
                    if pr.requisition_date
                    else None
                )
            )
            for line in lines:
                qty = Decimal(str(line.quantity or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        id=line.id,
                        source="document",
                        movement_type="purchase_requisition",
                        material_id=line.material_id,
                        material_code=line.material_code,
                        material_name=line.material_name,
                        material_spec=getattr(line, "material_spec", None),
                        quantity=qty,
                        source_doc_type="purchase_requisition",
                        source_doc_id=pr.id,
                        source_doc_code=pr.requisition_code,
                        work_order_id=wo.id,
                        work_order_code=wo.code,
                        operator_name=pr.applicant_name or getattr(pr, "created_by_name", None),
                        remark=str(pr.status or ""),
                        occurred_at=occurred,
                    )
                )

        for po_id in po_ids:
            po = await PurchaseOrder.get_or_none(
                tenant_id=tenant_id, id=po_id, deleted_at__isnull=True
            )
            if not po:
                continue
            lines = await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                order_id=po.id,
                material_id__in=material_id_list,
                deleted_at__isnull=True,
            ).all()
            occurred = _as_utc_aware(
                getattr(po, "created_at", None)
                or (
                    datetime.combine(po.order_date, datetime.min.time())
                    if po.order_date
                    else None
                )
            )
            for line in lines:
                qty = Decimal(str(line.ordered_quantity or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        id=line.id,
                        source="document",
                        movement_type="purchase_order",
                        material_id=line.material_id,
                        material_code=line.material_code,
                        material_name=line.material_name,
                        material_spec=getattr(line, "material_spec", None),
                        quantity=qty,
                        source_doc_type="purchase_order",
                        source_doc_id=po.id,
                        source_doc_code=po.order_code,
                        work_order_id=wo.id,
                        work_order_code=wo.code,
                        operator_name=po.buyer_name or getattr(po, "created_by_name", None),
                        remark=str(po.status or ""),
                        occurred_at=occurred,
                    )
                )

        await self._append_procurement_downstream_events(
            tenant_id, wo, po_ids, material_id_list, items
        )

        items.sort(key=_history_sort_key)
        return items

    async def _append_procurement_downstream_events(
        self,
        tenant_id: int,
        wo: WorkOrder,
        po_ids: Set[int],
        material_id_list: List[int],
        items: List[WorkOrderMaterialMovementItem],
    ) -> None:
        """采购订单下游：收货通知 → 来料检验 → 采购入库（按工单物料行）。"""
        if not po_ids or not material_id_list:
            return

        po_id_list = list(po_ids)

        notices = await ReceiptNotice.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=po_id_list,
            deleted_at__isnull=True,
        ).all()
        notice_by_id = {int(n.id): n for n in notices if n.id}
        if notice_by_id:
            notice_lines = await ReceiptNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(notice_by_id.keys()),
                material_id__in=material_id_list,
            ).all()
            for line in notice_lines:
                notice = notice_by_id.get(int(line.notice_id))
                if not notice:
                    continue
                qty = Decimal(str(line.notice_quantity or 0))
                if qty <= 0:
                    continue
                occurred = _as_utc_aware(
                    getattr(notice, "notified_at", None)
                    or getattr(notice, "created_at", None)
                )
                items.append(
                    WorkOrderMaterialMovementItem(
                        id=line.id,
                        source="document",
                        movement_type="receipt_notice",
                        material_id=line.material_id,
                        material_code=line.material_code,
                        material_name=line.material_name,
                        material_spec=getattr(line, "material_spec", None),
                        quantity=qty,
                        # 外采到货：来源侧展示供应商，目标为收货仓
                        from_warehouse_name=getattr(notice, "supplier_name", None),
                        to_warehouse_id=line.warehouse_id or notice.warehouse_id,
                        to_warehouse_name=line.warehouse_name or notice.warehouse_name,
                        source_doc_type="receipt_notice",
                        source_doc_id=notice.id,
                        source_doc_code=notice.notice_code,
                        work_order_id=wo.id,
                        work_order_code=wo.code,
                        operator_name=(
                            getattr(notice, "updated_by_name", None)
                            or getattr(notice, "created_by_name", None)
                        ),
                        remark=str(notice.status or ""),
                        occurred_at=occurred,
                    )
                )

        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=po_id_list,
            deleted_at__isnull=True,
        ).all()
        receipt_by_id = {
            int(r.id): r
            for r in receipts
            if r.id and str(r.status or "") not in ("已取消", "cancelled", "Cancelled")
        }
        receipt_ids = list(receipt_by_id.keys())

        if receipt_ids:
            inspections = await IncomingInspection.filter(
                tenant_id=tenant_id,
                purchase_receipt_id__in=receipt_ids,
                material_id__in=material_id_list,
                deleted_at__isnull=True,
            ).all()
            for insp in inspections:
                qty = Decimal(str(insp.inspection_quantity or 0))
                if qty <= 0:
                    continue
                occurred = _as_utc_aware(
                    getattr(insp, "inspection_time", None)
                    or getattr(insp, "created_at", None)
                )
                items.append(
                    WorkOrderMaterialMovementItem(
                        id=insp.id,
                        source="document",
                        movement_type="incoming_inspection",
                        material_id=insp.material_id,
                        material_code=insp.material_code,
                        material_name=insp.material_name,
                        material_spec=getattr(insp, "material_spec", None),
                        quantity=qty,
                        source_doc_type="incoming_inspection",
                        source_doc_id=insp.id,
                        source_doc_code=insp.inspection_code,
                        work_order_id=wo.id,
                        work_order_code=wo.code,
                        operator_name=insp.inspector_name
                        or getattr(insp, "updated_by_name", None),
                        remark=str(insp.status or insp.inspection_result or ""),
                        occurred_at=occurred,
                    )
                )

            receipt_lines = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id__in=receipt_ids,
                material_id__in=material_id_list,
                deleted_at__isnull=True,
            ).all()
            for line in receipt_lines:
                receipt = receipt_by_id.get(int(line.receipt_id))
                if not receipt:
                    continue
                qty = Decimal(str(line.receipt_quantity or 0))
                if qty <= 0:
                    continue
                status = str(receipt.status or line.status or "")
                posted = status in _PURCHASE_RECEIPT_POSTED
                # 已确认入库用业务入库时刻；草稿/待入库用建单时刻，避免用空 receipt_time 乱序
                if posted:
                    raw_occurred = (
                        getattr(line, "receipt_time", None)
                        or getattr(receipt, "receipt_time", None)
                        or getattr(receipt, "updated_at", None)
                        or getattr(receipt, "created_at", None)
                    )
                else:
                    raw_occurred = getattr(receipt, "created_at", None)
                occurred = _as_utc_aware(raw_occurred)
                items.append(
                    WorkOrderMaterialMovementItem(
                        id=line.id,
                        source="document",
                        movement_type="purchase_receipt",
                        material_id=line.material_id,
                        material_code=line.material_code,
                        material_name=line.material_name,
                        material_spec=getattr(line, "material_spec", None),
                        batch_no=getattr(line, "batch_number", None),
                        quantity=qty,
                        from_warehouse_name=getattr(receipt, "supplier_name", None),
                        to_warehouse_id=line.warehouse_id or receipt.warehouse_id,
                        to_warehouse_name=line.warehouse_name or receipt.warehouse_name,
                        source_doc_type="purchase_receipt",
                        source_doc_id=receipt.id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=wo.id,
                        work_order_code=wo.code,
                        operator_name=(
                            receipt.receiver_name
                            or getattr(receipt, "updated_by_name", None)
                            or getattr(receipt, "created_by_name", None)
                        ),
                        remark=status,
                        occurred_at=occurred,
                    )
                )

            # 库存流水上的采购入库（无 work_order_id，按入库单关联补入）
            ledger_rows = await MaterialStockMovement.filter(
                tenant_id=tenant_id,
                source_doc_type="purchase_receipt",
                source_doc_id__in=receipt_ids,
                material_id__in=material_id_list,
            ).all()
            for r in ledger_rows:
                items.append(
                    WorkOrderMaterialMovementItem(
                        id=r.id,
                        source="ledger",
                        movement_type=r.movement_type or "purchase_receipt",
                        material_id=r.material_id,
                        material_code=r.material_code,
                        batch_no=r.batch_no,
                        quantity=Decimal(str(r.quantity or 0)),
                        qty_before=r.qty_before,
                        qty_after=r.qty_after,
                        from_warehouse_id=r.from_warehouse_id,
                        from_warehouse_name=r.from_warehouse_name,
                        to_warehouse_id=r.to_warehouse_id,
                        to_warehouse_name=r.to_warehouse_name,
                        source_doc_type=r.source_doc_type,
                        source_doc_id=r.source_doc_id,
                        source_doc_code=r.source_doc_code,
                        work_order_id=wo.id,
                        work_order_code=wo.code,
                        operator_id=r.operator_id,
                        operator_name=r.operator_name,
                        remark=r.remark,
                        occurred_at=_as_utc_aware(r.created_at),
                    )
                )

    async def _append_procurement_ids_from_bom_materials(
        self,
        tenant_id: int,
        wo_material_ids: Set[int],
        pr_ids: Set[int],
        po_ids: Set[int],
    ) -> None:
        if not wo_material_ids:
            return
        material_ids = list(wo_material_ids)

        pr_lines = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            material_id__in=material_ids,
        ).limit(500)
        for line in pr_lines:
            if line.requisition_id:
                pr_ids.add(int(line.requisition_id))
            if line.purchase_order_id:
                po_ids.add(int(line.purchase_order_id))

        po_lines = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id__in=material_ids,
            deleted_at__isnull=True,
        ).limit(500)
        for line in po_lines:
            order_id = getattr(line, "order_id", None)
            if order_id:
                po_ids.add(int(order_id))

    async def _document_fallback(
        self,
        tenant_id: int,
        wo: WorkOrder,
        *,
        limit: int,
    ) -> List[WorkOrderMaterialMovementItem]:
        items: List[WorkOrderMaterialMovementItem] = []
        wo_id = wo.id
        wo_code = wo.code

        # 线边备料单（已确认/部分确认）
        batching_orders = await BatchingOrder.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for order in batching_orders:
            st = str(order.status or "")
            if st in ("draft", "cancelled", "草稿", "已取消"):
                continue
            order_items = await BatchingOrderItem.filter(
                tenant_id=tenant_id, batching_order_id=order.id
            ).all()
            for it in order_items:
                qty = Decimal(str(getattr(it, "picked_quantity", None) or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="staging_to_line",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_no", None),
                        quantity=qty,
                        from_warehouse_id=order.warehouse_id,
                        from_warehouse_name=getattr(order, "warehouse_name", None),
                        to_warehouse_id=order.target_warehouse_id,
                        to_warehouse_name=getattr(order, "target_warehouse_name", None),
                        source_doc_type="batching_order",
                        source_doc_id=order.id,
                        source_doc_code=order.code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=order.updated_at or order.created_at,
                    )
                )

        # 补料申请（已完成）
        calls = await MaterialCallRequest.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for call in calls:
            if str(call.status or "") not in ("completed", "已完成"):
                continue
            call_items = await MaterialCallRequestItem.filter(
                tenant_id=tenant_id, request_id=call.id
            ).all()
            for it in call_items:
                qty = Decimal(str(it.delivered_quantity or it.requested_quantity or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="staging_to_line",
                        material_id=it.material_id,
                        material_code=it.material_code,
                        material_name=it.material_name,
                        batch_no=getattr(it, "batch_no", None),
                        quantity=qty,
                        from_warehouse_id=call.source_warehouse_id,
                        to_warehouse_id=call.target_warehouse_id,
                        source_doc_type="material_call_request",
                        source_doc_id=call.id,
                        source_doc_code=call.code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=call.updated_at or call.created_at,
                    )
                )

        # 生产领料（正式发料，排除历史备料型）
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for picking in pickings:
            if is_staging_transfer_picking_notes(getattr(picking, "notes", None)):
                continue
            st = str(picking.status or "")
            if st not in ("已领料", "confirmed", "completed"):
                continue
            p_items = await ProductionPickingItem.filter(
                tenant_id=tenant_id, picking_id=picking.id
            ).all()
            for it in p_items:
                qty = Decimal(str(it.picked_quantity or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="production_issue",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=-qty,
                        from_warehouse_id=it.warehouse_id or picking.warehouse_id,
                        source_doc_type="production_picking",
                        source_doc_id=picking.id,
                        source_doc_code=picking.picking_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(picking, "picking_time", None)
                        or picking.updated_at
                        or picking.created_at,
                    )
                )

        # 生产退料
        returns = await ProductionReturn.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for ret in returns:
            st = str(ret.status or "")
            if st not in ("已退料", "confirmed", "completed"):
                continue
            r_items = await ProductionReturnItem.filter(
                tenant_id=tenant_id, return_id=ret.id
            ).all()
            for it in r_items:
                qty = Decimal(str(it.return_quantity or getattr(it, "quantity", 0) or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="production_return",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=qty,
                        to_warehouse_id=it.warehouse_id or ret.warehouse_id,
                        source_doc_type="production_return",
                        source_doc_id=ret.id,
                        source_doc_code=ret.return_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(ret, "return_time", None)
                        or ret.updated_at
                        or ret.created_at,
                    )
                )

        # 倒冲
        bfs = await BackflushRecord.filter(
            tenant_id=tenant_id,
            work_order_id=wo_id,
            status="completed",
            deleted_at__isnull=True,
        ).limit(100)
        for bf in bfs:
            qty = Decimal(str(bf.backflush_quantity or 0))
            if qty <= 0:
                continue
            items.append(
                WorkOrderMaterialMovementItem(
                    source="document",
                    movement_type="backflush_consume",
                    material_id=bf.material_id,
                    material_code=bf.material_code,
                    material_name=bf.material_name,
                    batch_no=bf.batch_no,
                    quantity=-qty,
                    from_warehouse_id=bf.warehouse_id,
                    from_warehouse_name=bf.warehouse_name,
                    source_doc_type="backflush_record",
                    source_doc_id=bf.id,
                    source_doc_code=bf.work_order_code,
                    work_order_id=wo_id,
                    work_order_code=wo_code,
                    occurred_at=bf.processed_at or bf.created_at,
                )
            )

        # 成品入库
        fgs = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for receipt in fgs:
            if str(receipt.status or "") not in ("已入库", "confirmed", "completed"):
                continue
            fg_items = await FinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt.id
            ).all()
            for it in fg_items:
                qty = Decimal(str(it.receipt_quantity or getattr(it, "quantity", 0) or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="fg_receipt",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=qty,
                        to_warehouse_id=it.warehouse_id or receipt.warehouse_id,
                        source_doc_type="finished_goods_receipt",
                        source_doc_id=receipt.id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(receipt, "receipt_time", None)
                        or receipt.updated_at
                        or receipt.created_at,
                    )
                )

        # 半成品入库
        sfs = await SemiFinishedGoodsReceipt.filter(
            tenant_id=tenant_id, work_order_id=wo_id, deleted_at__isnull=True
        ).limit(50)
        for receipt in sfs:
            if str(receipt.status or "") not in ("已入库", "confirmed", "completed"):
                continue
            sf_items = await SemiFinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt.id
            ).all()
            for it in sf_items:
                qty = Decimal(
                    str(it.receipt_quantity or it.qualified_quantity or 0)
                )
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="semi_fg_receipt",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=qty,
                        to_warehouse_id=getattr(it, "warehouse_id", None)
                        or receipt.warehouse_id,
                        source_doc_type="semi_finished_goods_receipt",
                        source_doc_id=receipt.id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(receipt, "receipt_time", None)
                        or receipt.updated_at
                        or receipt.created_at,
                    )
                )

        # 报废（已确认；可能未过账的历史单也展示）
        scraps = await ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=wo_id,
            deleted_at__isnull=True,
            status="confirmed",
        ).limit(50)
        for scrap in scraps:
            qty = Decimal(str(scrap.scrap_quantity or 0))
            if qty <= 0:
                continue
            items.append(
                WorkOrderMaterialMovementItem(
                    source="document",
                    movement_type="scrap",
                    material_id=scrap.product_id,
                    material_code=scrap.product_code,
                    material_name=scrap.product_name,
                    quantity=-qty,
                    from_warehouse_id=scrap.warehouse_id,
                    from_warehouse_name=scrap.warehouse_name,
                    source_doc_type="scrap_record",
                    source_doc_id=scrap.id,
                    source_doc_code=scrap.code,
                    work_order_id=wo_id,
                    work_order_code=wo_code,
                    remark=scrap.scrap_reason,
                    occurred_at=scrap.confirmed_at or scrap.updated_at or scrap.created_at,
                )
            )

        items.sort(key=lambda x: x.occurred_at or wo.created_at, reverse=True)
        return items[:limit]
