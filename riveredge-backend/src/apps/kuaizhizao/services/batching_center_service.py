"""
配料中心统一任务队列服务

聚合：主动备料建议、待处理叫料、草稿配料单、倒冲失败预警。
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from core.timezone_utils import make_aware, now_utc

from apps.kuaizhizao.models.batching_order import BatchingOrder, BatchingOrderItem
from apps.kuaizhizao.models.backflush_record import BackflushRecord
from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
from apps.kuaizhizao.models.material_call_request_item import MaterialCallRequestItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.batching_order import BatchingCenterTaskItem, BatchingCenterTaskListResponse
from apps.kuaizhizao.services.material_call_service import MaterialCallService
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.utils.issue_method_resolver import ISSUE_METHOD_PICK, is_batching_material
from apps.kuaizhizao.utils.warehouse_resolver import resolve_source_warehouse_for_work_order


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
    ) -> BatchingCenterTaskListResponse:
        tasks: List[BatchingCenterTaskItem] = []

        if not task_type or task_type == "proactive_prep":
            tasks.extend(await self._build_proactive_prep_tasks(tenant_id))

        if not task_type or task_type == "material_call":
            tasks.extend(await self._build_material_call_tasks(tenant_id, status))

        if not task_type or task_type == "batching_draft":
            tasks.extend(
                await self._build_batching_draft_tasks(
                    tenant_id, status, include_completed=include_completed_batching
                )
            )

        if not task_type or task_type == "backflush_alert":
            tasks.extend(await self._build_backflush_alert_tasks(tenant_id))

        if work_order_code:
            q = work_order_code.strip().lower()
            tasks = [t for t in tasks if (t.work_order_code or "").lower().find(q) >= 0 or (t.doc_code or "").lower().find(q) >= 0]

        if priority:
            tasks = [t for t in tasks if (t.priority or "normal") == priority]

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

    async def _build_proactive_prep_tasks(self, tenant_id: int) -> List[BatchingCenterTaskItem]:
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        wo_svc = WorkOrderService()
        score_svc = WorkOrderScoreService()

        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=self._ACTIVE_WO_STATUSES,
            deleted_at__isnull=True,
        ).exclude(status__in=self._TERMINAL_WO).all()

        if not work_orders:
            return []

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
            return []

        score_detail_map = await score_svc.batch_ensure_scores(
            tenant_id, wo_ids, "picking", refresh_if_stale=True, include_kitting=False
        )

        tasks: List[BatchingCenterTaskItem] = []
        for wo in work_orders:
            if wo.id in open_batch_wo_ids:
                continue
            try:
                kitting = await wo_svc.get_work_order_kitting_analysis(tenant_id, wo.id)
            except Exception:
                continue
            if kitting.status in ("fully_kitted", "no_bom"):
                continue

            reqs = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=wo.product_id,
                required_quantity=float(wo.quantity or 1),
                only_approved=True,
                variant_attributes=wo.variant_attributes,
                configurable_selections=wo.configurable_selections,
                for_kitting_analysis=True,
            )
            issue_map = {r.component_id: r.issue_method for r in reqs}

            batching_shortages = []
            for item in kitting.items:
                im = issue_map.get(item.material_id, ISSUE_METHOD_PICK)
                if not is_batching_material(im, None):
                    continue
                if item.shortage_quantity and item.shortage_quantity > Decimal("0"):
                    batching_shortages.append(item)

            if not batching_shortages:
                continue

            try:
                src_id, src_name = await resolve_source_warehouse_for_work_order(tenant_id, wo, None)
            except Exception:
                src_id, src_name = None, None

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
                    kitting_rate=float(kitting.kitting_rate),
                    shortage_summary=summary,
                    priority=wo.priority or "normal",
                    status="pending_prep",
                    created_at=wo.planned_start_date,
                    score_breakdown=score_detail.breakdown if score_detail else None,
                    suggested_warehouse_id=src_id,
                    suggested_warehouse_name=src_name,
                )
            )
        return tasks

    async def _build_material_call_tasks(
        self, tenant_id: int, status: Optional[str]
    ) -> List[BatchingCenterTaskItem]:
        query = MaterialCallRequest.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        else:
            query = query.filter(status__in=["pending", "processing", "partial"])

        calls = await query.order_by("-created_at").limit(200).all()
        if not calls:
            return []

        svc = MaterialCallService()
        score_svc = WorkOrderScoreService()
        wo_ids = list({c.work_order_id for c in calls if c.work_order_id})
        score_detail_map = await score_svc.batch_ensure_scores(
            tenant_id, wo_ids, "picking", refresh_if_stale=False, include_kitting=False
        )
        now = now_utc()
        tasks: List[BatchingCenterTaskItem] = []
        for call in calls:
            resp = await svc._build_response(call)
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
        return tasks

    async def _build_batching_draft_tasks(
        self,
        tenant_id: int,
        status: Optional[str],
        include_completed: bool = False,
    ) -> List[BatchingCenterTaskItem]:
        query = BatchingOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        elif include_completed:
            query = query.filter(status__in=["draft", "picking", "completed"])
        else:
            query = query.filter(status__in=["draft", "picking"])

        orders = await query.order_by("-updated_at").limit(200).all()
        if not orders:
            return []

        score_svc = WorkOrderScoreService()
        wo_ids = list({o.work_order_id for o in orders if o.work_order_id})
        order_ids = [o.id for o in orders]

        score_detail_map: dict = {}
        if wo_ids:
            score_detail_map = await score_svc.batch_ensure_scores(
                tenant_id, wo_ids, "picking", refresh_if_stale=False, include_kitting=False
            )

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

        from apps.kuaizhizao.services.batching_order_service import BatchingOrderService

        batch_svc = BatchingOrderService()
        for order in orders:
            wo = wo_map.get(order.work_order_id) if order.work_order_id else None
            if not wo or order.status not in ("draft", "picking"):
                continue
            try:
                synced = await batch_svc._sync_shortage_lines_to_draft_order(
                    tenant_id, order, wo, updated_by=None
                )
                items_by_order[order.id] = list(synced.items or [])
            except Exception:
                continue

        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        wo_svc = WorkOrderService()
        kitting_map: dict = {}
        for wo_id in wo_ids:
            try:
                kitting_map[wo_id] = await wo_svc.get_work_order_kitting_analysis(tenant_id, wo_id)
            except Exception:
                continue

        tasks: List[BatchingCenterTaskItem] = []
        for order in orders:
            score_detail = score_detail_map.get(order.work_order_id) if order.work_order_id else None
            wo = wo_map.get(order.work_order_id) if order.work_order_id else None
            kitting = kitting_map.get(order.work_order_id) if order.work_order_id else None
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
                    kitting_rate=float(kitting.kitting_rate) if kitting else None,
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
        return tasks

    async def _build_backflush_alert_tasks(self, tenant_id: int) -> List[BatchingCenterTaskItem]:
        since = now_utc() - timedelta(days=7)
        rows = await BackflushRecord.filter(
            tenant_id=tenant_id,
            status="failed",
            deleted_at__isnull=True,
            processed_at__gte=since,
        ).order_by("-processed_at").limit(50).all()

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
        return tasks
