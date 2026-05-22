"""
配料中心统一任务队列服务

聚合：主动备料建议、待处理叫料、草稿配料单、倒冲失败预警。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from core.timezone_utils import make_aware, now_utc

from apps.kuaizhizao.models.batching_order import BatchingOrder, BatchingOrderItem
from apps.kuaizhizao.models.backflush_record import BackflushRecord
from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
from apps.kuaizhizao.models.material_call_request_item import MaterialCallRequestItem
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.batching_order import BatchingCenterTaskItem, BatchingCenterTaskListResponse
from apps.kuaizhizao.services.material_call_service import MaterialCallService
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.utils.inventory_helper import batch_get_material_inventory
from apps.kuaizhizao.utils.issue_method_resolver import ISSUE_METHOD_PICK, is_batching_material


@dataclass
class _BatchingShortageLine:
    material_id: int
    material_code: str
    material_name: str
    shortage_quantity: Decimal


class BatchingCenterService:
    """配料中心任务队列"""

    # 与 batching_order_service._ALLOWED_WO_STATUSES、工单列表「未完成」口径一致
    _ACTIVE_WO_STATUSES = (
        "draft",
        "released",
        "dispatched",
        "confirmed",
        "in_progress",
        "草稿",
        "已下达",
        "已确认",
        "执行中",
    )
    _TERMINAL_WO = ("completed", "cancelled", "已完工", "已取消")
    # 主动备料仅扫描计划开工最近的工单，避免全量活跃工单齐套分析
    _PROACTIVE_PREP_WO_LIMIT = 40

    async def _batch_picked_quantities(
        self, tenant_id: int, work_order_id: int, material_ids: List[int]
    ) -> Dict[int, Decimal]:
        if not material_ids:
            return {}
        picking_ids = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
        pid_list = list(picking_ids)
        result = {mid: Decimal("0") for mid in material_ids}
        if not pid_list:
            return result
        items = await ProductionPickingItem.filter(
            tenant_id=tenant_id,
            picking_id__in=pid_list,
            material_id__in=material_ids,
            status__in=["已领料", "已确认", "picked", "confirmed"],
        ).all()
        for it in items:
            mid = it.material_id
            if mid in result:
                result[mid] += Decimal(str(it.picked_quantity or 0))
        return result

    async def _analyze_wo_batching_shortages(
        self, tenant_id: int, wo: WorkOrder
    ) -> Tuple[Optional[float], List[_BatchingShortageLine], str]:
        """
        轻量齐套快照：单次 BOM 展开 + 批量库存，不做逐物料库位查询。
        返回 (齐套率, 配料缺料行, status)；status 为 no_bom | fully_kitted | shortage。
        """
        try:
            reqs = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=wo.product_id,
                required_quantity=float(wo.quantity or 1),
                only_approved=True,
                variant_attributes=wo.variant_attributes,
                configurable_selections=wo.configurable_selections,
                for_kitting_analysis=True,
            )
        except Exception:
            return None, [], "no_bom"
        if not reqs:
            return None, [], "no_bom"

        issue_map = {r.component_id: r.issue_method for r in reqs}
        comp_ids = [r.component_id for r in reqs]
        inventory_map = await batch_get_material_inventory(tenant_id, comp_ids)
        picked_map = await self._batch_picked_quantities(tenant_id, wo.id, comp_ids)

        batching_shortages: List[_BatchingShortageLine] = []
        fully_kitted_count = 0
        batching_item_count = 0

        for req in reqs:
            im = issue_map.get(req.component_id, ISSUE_METHOD_PICK)
            if not is_batching_material(im, None):
                continue
            batching_item_count += 1
            required = Decimal(str(req.gross_requirement))
            picked = picked_map.get(req.component_id, Decimal("0"))
            inv = inventory_map.get(req.component_id, Decimal("0"))
            total_avail = picked + inv
            if total_avail >= required:
                fully_kitted_count += 1
                continue
            shortage = required - total_avail
            if shortage <= 0:
                fully_kitted_count += 1
                continue
            batching_shortages.append(
                _BatchingShortageLine(
                    material_id=req.component_id,
                    material_code=getattr(req, "component_code", "") or "",
                    material_name=req.component_name or "",
                    shortage_quantity=shortage,
                )
            )

        if batching_item_count == 0:
            return None, [], "no_bom"

        kitting_rate = round(fully_kitted_count / batching_item_count * 100, 2)
        if not batching_shortages:
            return kitting_rate, [], "fully_kitted"
        return kitting_rate, batching_shortages, "shortage"

    async def list_tasks(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50,
        task_type: Optional[str] = None,
        status: Optional[str] = None,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
        include_completed_batching: bool = False,
        include_proactive_prep: bool = False,
    ) -> BatchingCenterTaskListResponse:
        filters = {
            "work_order_code": work_order_code,
            "priority": priority,
        }

        if task_type == "material_call":
            items, total = await self._build_material_call_tasks(
                tenant_id, status, skip=skip, limit=limit, **filters
            )
            return BatchingCenterTaskListResponse(items=items, total=total)

        if task_type == "batching_draft":
            items, total = await self._build_batching_draft_tasks(
                tenant_id,
                status,
                skip=skip,
                limit=limit,
                include_completed=include_completed_batching,
                **filters,
            )
            return BatchingCenterTaskListResponse(items=items, total=total)

        if task_type == "proactive_prep":
            items, total = await self._build_proactive_prep_tasks(
                tenant_id, skip=skip, limit=limit, **filters
            )
            return BatchingCenterTaskListResponse(items=items, total=total)

        if task_type == "backflush_alert":
            items, total = await self._build_backflush_alert_tasks(
                tenant_id, skip=skip, limit=limit, **filters
            )
            return BatchingCenterTaskListResponse(items=items, total=total)

        # 未指定 task_type：仅合并轻量任务；主动备料需显式 task_type 或 include_proactive_prep
        tasks: List[BatchingCenterTaskItem] = []
        mc_items, _ = await self._build_material_call_tasks(
            tenant_id, status, skip=0, limit=200, **filters
        )
        tasks.extend(mc_items)
        bd_items, _ = await self._build_batching_draft_tasks(
            tenant_id,
            status,
            skip=0,
            limit=200,
            include_completed=include_completed_batching,
            **filters,
        )
        tasks.extend(bd_items)
        bf_items, _ = await self._build_backflush_alert_tasks(
            tenant_id, skip=0, limit=50, **filters
        )
        tasks.extend(bf_items)
        if include_proactive_prep:
            pp_items, _ = await self._build_proactive_prep_tasks(
                tenant_id, skip=0, limit=50, **filters
            )
            tasks.extend(pp_items)

        tasks.sort(
            key=lambda t: (
                0 if t.sla_overdue else 1,
                -(t.picking_score or 0),
                t.created_at or datetime.max,
            )
        )
        total = len(tasks)
        page = tasks[skip : skip + limit]
        return BatchingCenterTaskListResponse(items=page, total=total)

    @staticmethod
    def _apply_task_filters(
        tasks: List[BatchingCenterTaskItem],
        *,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> List[BatchingCenterTaskItem]:
        result = tasks
        if work_order_code:
            q = work_order_code.strip().lower()
            result = [
                t
                for t in result
                if (t.work_order_code or "").lower().find(q) >= 0
                or (t.doc_code or "").lower().find(q) >= 0
            ]
        if priority:
            result = [t for t in result if (t.priority or "normal") == priority]
        return result

    @staticmethod
    def _sort_tasks(tasks: List[BatchingCenterTaskItem]) -> None:
        tasks.sort(
            key=lambda t: (
                0 if t.sla_overdue else 1,
                -(t.picking_score or 0),
                t.created_at or datetime.max,
            )
        )

    async def _build_proactive_prep_tasks(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> Tuple[List[BatchingCenterTaskItem], int]:
        score_svc = WorkOrderScoreService()

        wo_query = WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=self._ACTIVE_WO_STATUSES,
            deleted_at__isnull=True,
        ).exclude(status__in=self._TERMINAL_WO)
        if work_order_code:
            wo_query = wo_query.filter(code__icontains=work_order_code.strip())
        if priority:
            wo_query = wo_query.filter(priority=priority)

        work_orders = await wo_query.order_by("planned_start_date", "id").limit(
            self._PROACTIVE_PREP_WO_LIMIT
        ).all()

        if not work_orders:
            return [], 0

        open_batch_wo_ids = set(
            await BatchingOrder.filter(
                tenant_id=tenant_id,
                status__in=["draft", "picking"],
                deleted_at__isnull=True,
                work_order_id__isnull=False,
            ).values_list("work_order_id", flat=True)
        )

        wo_ids = [wo.id for wo in work_orders if wo.id not in open_batch_wo_ids]
        if not wo_ids:
            return [], 0

        score_detail_map = await score_svc.batch_get_scores(tenant_id, wo_ids, "picking")

        tasks: List[BatchingCenterTaskItem] = []
        for wo in work_orders:
            if wo.id in open_batch_wo_ids:
                continue
            kitting_rate, batching_shortages, status = await self._analyze_wo_batching_shortages(
                tenant_id, wo
            )
            if status in ("fully_kitted", "no_bom") or not batching_shortages:
                continue

            summary = "、".join(
                f"{x.material_name}(缺{float(x.shortage_quantity):g})" for x in batching_shortages[:3]
            )
            if len(batching_shortages) > 3:
                summary += f" 等{len(batching_shortages)}项"

            score_detail = score_detail_map.get(wo.id)
            tasks.append(
                BatchingCenterTaskItem(
                    task_type="proactive_prep",
                    task_id=wo.id,
                    doc_code=wo.code,
                    work_order_id=wo.id,
                    work_order_code=wo.code,
                    product_name=wo.product_name,
                    picking_score=score_detail.composite_score if score_detail else None,
                    picking_rank_band=score_detail.rank_band if score_detail else None,
                    kitting_rate=kitting_rate,
                    shortage_summary=summary,
                    priority=wo.priority or "normal",
                    status="pending_prep",
                    created_at=wo.planned_start_date,
                    score_breakdown=score_detail.breakdown if score_detail else None,
                    suggested_warehouse_id=None,
                    suggested_warehouse_name=None,
                )
            )
        self._sort_tasks(tasks)
        total = len(tasks)
        return tasks[skip : skip + limit], total

    async def _build_material_call_tasks(
        self,
        tenant_id: int,
        status: Optional[str],
        skip: int = 0,
        limit: int = 50,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> Tuple[List[BatchingCenterTaskItem], int]:
        query = MaterialCallRequest.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        else:
            query = query.filter(status__in=["pending", "processing", "partial"])
        if work_order_code:
            query = query.filter(work_order_code__icontains=work_order_code.strip())
        if priority:
            query = query.filter(priority=priority)

        total = await query.count()
        calls = await query.order_by("-created_at").offset(skip).limit(limit).all()
        if not calls:
            return [], total

        svc = MaterialCallService()
        score_svc = WorkOrderScoreService()
        wo_ids = list({c.work_order_id for c in calls if c.work_order_id})
        score_detail_map = await score_svc.batch_get_scores(tenant_id, wo_ids, "picking")
        call_ids = [c.id for c in calls]
        all_call_items = await MaterialCallRequestItem.filter(
            tenant_id=tenant_id, request_id__in=call_ids
        ).order_by("line_no", "id").all()
        items_by_call: dict = {}
        for line in all_call_items:
            items_by_call.setdefault(line.request_id, []).append(line)

        now = now_utc()
        tasks: List[BatchingCenterTaskItem] = []
        for call in calls:
            resp = await svc._build_response(call, items_by_call.get(call.id, []))
            sla = False
            if call.needed_at:
                sla = now > make_aware(call.needed_at)
            score_detail = score_detail_map.get(call.work_order_id) if call.work_order_id else None
            tasks.append(
                BatchingCenterTaskItem(
                    task_type="material_call",
                    task_id=call.id,
                    doc_code=call.code,
                    work_order_id=call.work_order_id,
                    work_order_code=call.work_order_code,
                    picking_score=score_detail.composite_score if score_detail else None,
                    picking_rank_band=score_detail.rank_band if score_detail else None,
                    score_breakdown=score_detail.breakdown if score_detail else None,
                    priority=call.priority or "normal",
                    sla_overdue=sla,
                    status=call.status,
                    material_name=call.material_name,
                    material_code=call.material_code,
                    requested_quantity=float(call.requested_quantity or 0),
                    material_unit=call.material_unit,
                    caller_name=call.caller_name,
                    created_at=call.created_at,
                    updated_at=call.updated_at,
                    items=[ln.model_dump() for ln in (resp.items or [])],
                )
            )
        self._sort_tasks(tasks)
        return tasks, total

    async def _build_batching_draft_tasks(
        self,
        tenant_id: int,
        status: Optional[str],
        skip: int = 0,
        limit: int = 50,
        include_completed: bool = False,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> Tuple[List[BatchingCenterTaskItem], int]:
        query = BatchingOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        elif include_completed:
            query = query.filter(status__in=["draft", "picking", "completed"])
        else:
            query = query.filter(status__in=["draft", "picking"])

        if work_order_code:
            query = query.filter(work_order_code__icontains=work_order_code.strip())

        if priority:
            order_ids_for_priority = await WorkOrder.filter(
                tenant_id=tenant_id,
                priority=priority,
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
            pid_list = list(order_ids_for_priority)
            if not pid_list:
                return [], 0
            query = query.filter(work_order_id__in=pid_list)

        total = await query.count()
        orders = await query.order_by("-updated_at").offset(skip).limit(limit).all()
        if not orders:
            return [], total

        score_svc = WorkOrderScoreService()
        wo_ids = list({o.work_order_id for o in orders if o.work_order_id})
        order_ids = [o.id for o in orders]

        score_detail_map: dict = {}
        if wo_ids:
            score_detail_map = await score_svc.batch_get_scores(tenant_id, wo_ids, "picking")

        wo_map: dict = {}
        if wo_ids:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id, id__in=wo_ids, deleted_at__isnull=True
            ).all()
            wo_map = {w.id: w for w in work_orders}

        order_items = await BatchingOrderItem.filter(
            tenant_id=tenant_id,
            batching_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).order_by("id")
        items_by_order: dict = {}
        for item in order_items:
            items_by_order.setdefault(item.batching_order_id, []).append(item)

        tasks: List[BatchingCenterTaskItem] = []
        for order in orders:
            score_detail = score_detail_map.get(order.work_order_id) if order.work_order_id else None
            wo = wo_map.get(order.work_order_id) if order.work_order_id else None
            lines = items_by_order.get(order.id, [])
            summary = "、".join(
                f"{ln.material_name}({float(ln.required_quantity or 0):g})" for ln in lines[:3]
            )
            if len(lines) > 3:
                summary += f" 等{len(lines)}项"

            tasks.append(
                BatchingCenterTaskItem(
                    task_type="batching_draft",
                    task_id=order.id,
                    doc_code=order.code,
                    work_order_id=order.work_order_id,
                    work_order_code=order.work_order_code,
                    product_name=wo.product_name if wo else None,
                    picking_score=score_detail.composite_score if score_detail else None,
                    picking_rank_band=score_detail.rank_band if score_detail else None,
                    score_breakdown=score_detail.breakdown if score_detail else None,
                    kitting_rate=None,
                    shortage_summary=summary or None,
                    requested_quantity=float(wo.quantity) if wo and wo.quantity else None,
                    priority=wo.priority if wo and wo.priority else "normal",
                    status=order.status,
                    created_at=order.created_at,
                    updated_at=order.updated_at,
                    suggested_warehouse_id=order.warehouse_id,
                    suggested_warehouse_name=order.warehouse_name,
                )
            )
        self._sort_tasks(tasks)
        return tasks, total

    async def _build_backflush_alert_tasks(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> Tuple[List[BatchingCenterTaskItem], int]:
        since = now_utc() - timedelta(days=7)
        query = BackflushRecord.filter(
            tenant_id=tenant_id,
            status="failed",
            deleted_at__isnull=True,
            processed_at__gte=since,
        )
        if work_order_code:
            query = query.filter(work_order_code__icontains=work_order_code.strip())

        total = await query.count()
        rows = await query.order_by("-processed_at").offset(skip).limit(limit).all()

        tasks: List[BatchingCenterTaskItem] = []
        for row in rows:
            tasks.append(
                BatchingCenterTaskItem(
                    task_type="backflush_alert",
                    task_id=row.id,
                    doc_code=row.work_order_code,
                    work_order_id=row.work_order_id,
                    work_order_code=row.work_order_code,
                    material_name=row.material_name,
                    material_code=row.material_code,
                    requested_quantity=float(row.backflush_quantity or 0),
                    material_unit=row.material_unit,
                    status=row.status,
                    error_message=row.error_message,
                    created_at=row.processed_at,
                )
            )
        if priority:
            tasks = self._apply_task_filters(tasks, priority=priority)
            total = len(tasks)
        return tasks, total
