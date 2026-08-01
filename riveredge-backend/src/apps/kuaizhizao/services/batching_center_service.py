"""
配料中心统一任务队列服务

聚合：主动备料建议、待处理叫料、草稿配料单、倒冲失败预警。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from core.utils.timezone_utils import make_aware, now_utc
from loguru import logger

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
from apps.kuaizhizao.utils.issue_method_resolver import ISSUE_METHOD_PICK, is_batching_material
from apps.kuaizhizao.utils.warehouse_resolver import resolve_line_side_warehouse_for_work_order
from infra.exceptions.exceptions import BusinessLogicError


@dataclass
class _BatchingShortageLine:
    material_id: int
    material_code: str
    material_name: str
    shortage_quantity: Decimal


class BatchingCenterService:
    """配料中心任务队列"""

    # 主动备料建议：仅已下达/执行中工单（草稿/已取消不参与线边备料）
    _PREP_SUGGESTION_WO_STATUSES = (
        "released",
        "dispatched",
        "confirmed",
        "in_progress",
        "已下达",
        "已确认",
        "执行中",
    )
    # 线边备料单列表：关联工单须仍为有效备料对象（排除草稿/已取消/已删除）
    _OPEN_BATCHING_WO_STATUSES = _PREP_SUGGESTION_WO_STATUSES
    _TERMINAL_WO = ("completed", "cancelled", "已完工", "已取消")
    # 主动备料仅扫描计划开工最近的工单，避免全量活跃工单齐套分析
    _PROACTIVE_PREP_WO_LIMIT = 40

    async def _batch_picked_quantities(
        self, tenant_id: int, work_order_id: int, material_ids: List[int]
    ) -> Dict[int, Decimal]:
        """正式发料累计（排除历史叫料备料转移型领料单）。"""
        from apps.kuaizhizao.utils.picking_posting import filter_gi_picking_ids

        if not material_ids:
            return {}
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        pid_list = filter_gi_picking_ids(pickings)
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
    ) -> Tuple[Optional[float], List[_BatchingShortageLine], str, Optional[float]]:
        """
        轻量齐套快照：单次 BOM 展开 + 批量库存，不做逐物料库位查询。

        返回 (线边齐套率, 配料缺料行, status, 厂库齐套率)。
        - 缺料判定与下推备料单一致：已领 + 线边 + 关联工单供给（不含主仓）。
        - 厂库齐套率另含主仓批次，与工单列表齐套率同口径。
        status: no_bom | fully_kitted | shortage
        """
        from datetime import date

        from tortoise.expressions import Q

        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
        from apps.kuaizhizao.utils.material_source_helper import (
            SOURCE_TYPE_CONFIGURE,
            SOURCE_TYPE_MAKE,
        )
        from apps.master_data.models.material_batch import MaterialBatch

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
            return None, [], "no_bom", None
        if not reqs:
            return None, [], "no_bom", None

        issue_map = {r.component_id: r.issue_method for r in reqs}
        comp_ids = [r.component_id for r in reqs]

        line_side_map: Dict[int, Decimal] = {mid: Decimal("0") for mid in comp_ids}
        try:
            line_items = await LineSideInventory.filter(
                tenant_id=tenant_id,
                material_id__in=comp_ids,
                deleted_at__isnull=True,
                status="available",
            ).all()
            for item in line_items:
                mid = int(item.material_id)
                available = (item.quantity or Decimal("0")) - (item.reserved_quantity or Decimal("0"))
                if available > 0 and mid in line_side_map:
                    line_side_map[mid] += available
        except Exception:
            line_side_map = {mid: Decimal("0") for mid in comp_ids}

        main_map: Dict[int, Decimal] = {mid: Decimal("0") for mid in comp_ids}
        try:
            today = date.today()
            batch_filter = Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            batches = (
                await MaterialBatch.filter(
                    tenant_id=tenant_id,
                    material_id__in=comp_ids,
                    deleted_at__isnull=True,
                    quantity__gt=0,
                )
                .filter(~Q(status__in=["out_stock", "scrapped", "expired"]))
                .filter(batch_filter)
                .all()
            )
            for batch in batches:
                mid = int(batch.material_id)
                if mid in main_map:
                    main_map[mid] += Decimal(str(batch.quantity or 0))
        except Exception:
            main_map = {mid: Decimal("0") for mid in comp_ids}

        picked_map = await self._batch_picked_quantities(tenant_id, wo.id, comp_ids)

        # 关联子工单完工量（与 get_work_order_kitting_analysis / 下推缺料同口径）
        component_wos: Dict[int, WorkOrder] = {}
        if wo.work_order_group_id:
            child_rows = await WorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=wo.work_order_group_id,
                bom_parent_work_order_id=wo.id,
                deleted_at__isnull=True,
            ).all()
            component_wos = {int(r.product_id): r for r in child_rows if r.product_id}

        batching_shortages: List[_BatchingShortageLine] = []
        line_fully_kitted_count = 0
        factory_fully_kitted_count = 0
        batching_item_count = 0

        for req in reqs:
            im = issue_map.get(req.component_id, ISSUE_METHOD_PICK)
            source_type = getattr(req, "component_type", None)
            if not is_batching_material(im, source_type):
                continue
            batching_item_count += 1
            required = Decimal(str(req.gross_requirement))
            picked = picked_map.get(req.component_id, Decimal("0"))
            line_side = line_side_map.get(req.component_id, Decimal("0"))
            main_qty = main_map.get(req.component_id, Decimal("0"))
            wo_supply = Decimal("0")
            if source_type in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
                child_wo = component_wos.get(int(req.component_id))
                if child_wo:
                    wo_supply = Decimal(str(child_wo.completed_quantity or 0))
            # 配料缺料：正式发料 + 线边 + 关联工单供给（不含主仓）
            line_ready = picked + line_side + wo_supply
            factory_ready = line_ready + main_qty
            if factory_ready >= required:
                factory_fully_kitted_count += 1
            if line_ready >= required:
                line_fully_kitted_count += 1
                continue
            shortage = required - line_ready
            if shortage <= 0:
                line_fully_kitted_count += 1
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
            return None, [], "no_bom", None

        line_kitting_rate = round(line_fully_kitted_count / batching_item_count * 100, 2)
        factory_kitting_rate = round(factory_fully_kitted_count / batching_item_count * 100, 2)
        if not batching_shortages:
            return line_kitting_rate, [], "fully_kitted", factory_kitting_rate
        return line_kitting_rate, batching_shortages, "shortage", factory_kitting_rate

    async def list_tasks(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50,
        task_type: Optional[str] = None,
        status: Optional[str] = None,
        work_order_code: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        priority: Optional[str] = None,
        include_completed_batching: bool = False,
        include_proactive_prep: bool = False,
    ) -> BatchingCenterTaskListResponse:
        filters = {
            "keyword": keyword,
            "work_order_code": work_order_code or keyword,
            "priority": priority,
            "order_by": order_by,
        }

        builder_filters = self._builder_query_filters(filters)

        if task_type == "material_call":
            items, total = await self._build_material_call_tasks(
                tenant_id, status, skip=skip, limit=limit, **builder_filters
            )
            self._sort_tasks_by_order(items, filters.get("order_by"))
            return BatchingCenterTaskListResponse(items=items, total=total)

        if task_type == "batching_draft":
            items, total = await self._build_batching_draft_tasks(
                tenant_id,
                status,
                skip=skip,
                limit=limit,
                include_completed=include_completed_batching,
                **builder_filters,
            )
            self._sort_tasks_by_order(items, filters.get("order_by"))
            return BatchingCenterTaskListResponse(items=items, total=total)

        if task_type == "proactive_prep":
            items, total = await self._build_proactive_prep_tasks(
                tenant_id, skip=skip, limit=limit, **builder_filters
            )
            self._sort_tasks_by_order(items, filters.get("order_by"))
            return BatchingCenterTaskListResponse(items=items, total=total)

        # 线边备料：备料建议 + 线边备料单草稿/拣货合并（行级 task_type 仍为 proactive_prep|batching_draft）
        if task_type == "line_side_prep":
            pp_items, _ = await self._build_proactive_prep_tasks(
                tenant_id,
                skip=0,
                limit=self._PROACTIVE_PREP_WO_LIMIT,
                **builder_filters,
            )
            # status 仅作用于草稿行；建议行无单据状态
            bd_items, _ = await self._build_batching_draft_tasks(
                tenant_id,
                status,
                skip=0,
                limit=200,
                include_completed=include_completed_batching,
                **builder_filters,
            )
            tasks = list(pp_items) + list(bd_items)
            self._sort_tasks_by_order(tasks, filters.get("order_by"))
            total = len(tasks)
            return BatchingCenterTaskListResponse(items=tasks[skip : skip + limit], total=total)

        if task_type == "backflush_alert":
            items, total = await self._build_backflush_alert_tasks(
                tenant_id, skip=skip, limit=limit, **builder_filters
            )
            self._sort_tasks_by_order(items, filters.get("order_by"))
            return BatchingCenterTaskListResponse(items=items, total=total)

        # 未指定 task_type：仅合并轻量任务；主动备料需显式 task_type 或 include_proactive_prep
        tasks: List[BatchingCenterTaskItem] = []
        mc_items, _ = await self._build_material_call_tasks(
            tenant_id, status, skip=0, limit=200, **builder_filters
        )
        tasks.extend(mc_items)
        bd_items, _ = await self._build_batching_draft_tasks(
            tenant_id,
            status,
            skip=0,
            limit=200,
            include_completed=include_completed_batching,
            **builder_filters,
        )
        tasks.extend(bd_items)
        bf_items, _ = await self._build_backflush_alert_tasks(
            tenant_id, skip=0, limit=50, **builder_filters
        )
        tasks.extend(bf_items)
        if include_proactive_prep:
            pp_items, _ = await self._build_proactive_prep_tasks(
                tenant_id, skip=0, limit=50, **builder_filters
            )
            tasks.extend(pp_items)

        self._sort_tasks_by_order(tasks, filters.get("order_by"))
        total = len(tasks)
        page = tasks[skip : skip + limit]
        return BatchingCenterTaskListResponse(items=page, total=total)

    @staticmethod
    def _builder_query_filters(filters: dict) -> dict:
        """仅向各 _build_* 传递其支持的查询参数（不含 keyword/order_by）。"""
        return {
            "work_order_code": filters.get("work_order_code"),
            "priority": filters.get("priority"),
        }

    @staticmethod
    def _apply_task_filters(
        tasks: List[BatchingCenterTaskItem],
        *,
        keyword: Optional[str] = None,
        work_order_code: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> List[BatchingCenterTaskItem]:
        result = tasks
        search_text = (keyword or work_order_code or "").strip().lower()
        if search_text:
            result = [
                t
                for t in result
                if search_text in (t.work_order_code or "").lower()
                or search_text in (t.doc_code or "").lower()
                or search_text in (t.material_code or "").lower()
                or search_text in (t.material_name or "").lower()
                or search_text in (t.product_name or "").lower()
            ]
        if priority:
            result = [t for t in result if (t.priority or "normal") == priority]
        return result

    @staticmethod
    def _sort_tasks_by_order(tasks: List[BatchingCenterTaskItem], order_by: Optional[str]) -> None:
        if not order_by:
            BatchingCenterService._sort_tasks(tasks)
            return
        from apps.kuaizhizao.services.warehouse_list_core import (
            BATCHING_CENTER_TASK_SORTABLE_FIELDS,
            sort_inventory_report_rows,
        )
        task_map = {(t.task_type, t.task_id): t for t in tasks}
        sorted_rows = sort_inventory_report_rows(
            [t.model_dump() for t in tasks],
            order_by,
            BATCHING_CENTER_TASK_SORTABLE_FIELDS,
            "-created_at",
        )
        tasks[:] = [
            task_map[(row["task_type"], row["task_id"])]
            for row in sorted_rows
            if (row.get("task_type"), row.get("task_id")) in task_map
        ]

    @staticmethod
    def _sort_tasks(tasks: List[BatchingCenterTaskItem]) -> None:
        fallback_created_at = datetime.max.replace(tzinfo=timezone.utc)
        tasks.sort(
            key=lambda t: (
                0 if t.sla_overdue else 1,
                -(t.picking_score or 0),
                t.created_at or fallback_created_at,
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
            status__in=self._PREP_SUGGESTION_WO_STATUSES,
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
            try:
                (
                    _line_kitting_rate,
                    batching_shortages,
                    status,
                    factory_kitting_rate,
                ) = await self._analyze_wo_batching_shortages(tenant_id, wo)
                if status in ("fully_kitted", "no_bom") or not batching_shortages:
                    continue

                summary = "、".join(
                    f"{x.material_name}(缺{float(x.shortage_quantity):g})" for x in batching_shortages[:3]
                )
                if len(batching_shortages) > 3:
                    summary += f" 等{len(batching_shortages)}项"

                # 列表「齐套率」与工单页同口径（含主仓）；仍因线边缺料出现在建议中
                display_rate = (
                    factory_kitting_rate
                    if factory_kitting_rate is not None
                    else _line_kitting_rate
                )
                # 主仓已齐但仍需主仓→线边：待备；主仓也缺：缺料待备
                prep_status = (
                    "ready_to_prep"
                    if factory_kitting_rate is not None and factory_kitting_rate >= 100
                    else "pending_prep"
                )

                score_detail = score_detail_map.get(wo.id)
                tgt_wh_id: Optional[int] = None
                tgt_wh_name: Optional[str] = None
                try:
                    tgt_wh_id, tgt_wh_name = await resolve_line_side_warehouse_for_work_order(
                        tenant_id, wo, None
                    )
                except BusinessLogicError:
                    logger.warning(
                        "备料建议未解析到线边仓: tenant_id={}, work_order_id={}",
                        tenant_id,
                        wo.id,
                    )

                created_by_name = getattr(wo, "created_by_name", None) or None
                updated_by_name = getattr(wo, "updated_by_name", None) or created_by_name
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
                        kitting_rate=display_rate,
                        shortage_summary=summary,
                        requested_quantity=float(wo.quantity) if wo.quantity is not None else None,
                        total_items=len(batching_shortages),
                        priority=wo.priority or "normal",
                        status=prep_status,
                        created_by_name=created_by_name,
                        updated_by_name=updated_by_name,
                        created_at=wo.created_at or wo.planned_start_date,
                        updated_at=wo.updated_at or wo.created_at,
                        score_breakdown=score_detail.breakdown if score_detail else None,
                        suggested_warehouse_id=tgt_wh_id,
                        suggested_warehouse_name=tgt_wh_name,
                        target_warehouse_name=tgt_wh_name,
                    )
                )
            except Exception as exc:
                logger.exception(
                    "构建主动备料任务失败: tenant_id={}, work_order_id={}, error={}",
                    tenant_id,
                    getattr(wo, "id", None),
                    exc,
                )
                continue
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

        wh_ids = list({c.target_warehouse_id for c in calls if c.target_warehouse_id})
        wh_name_by_id: dict = {}
        if wh_ids:
            from apps.master_data.models.warehouse import Warehouse

            warehouses = await Warehouse.filter(
                tenant_id=tenant_id, id__in=wh_ids, deleted_at__isnull=True
            ).all()
            wh_name_by_id = {w.id: (w.name or "") for w in warehouses}

        now = now_utc()
        tasks: List[BatchingCenterTaskItem] = []
        for call in calls:
            resp = await svc._build_response(call, items_by_call.get(call.id, []))
            sla = False
            if call.needed_at:
                sla = now > make_aware(call.needed_at)
            score_detail = score_detail_map.get(call.work_order_id) if call.work_order_id else None
            tgt_wh_name = None
            if call.target_warehouse_id:
                tgt_wh_name = wh_name_by_id.get(call.target_warehouse_id) or None
            created_by_name = getattr(call, "created_by_name", None) or call.caller_name
            updated_by_name = getattr(call, "updated_by_name", None) or created_by_name
            call_items = resp.items or []
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
                    total_items=len(call_items) if call_items else (1 if call.material_id else None),
                    delivered_quantity=float(call.delivered_quantity or 0),
                    material_unit=call.material_unit,
                    caller_name=call.caller_name,
                    created_by_name=created_by_name,
                    updated_by_name=updated_by_name,
                    created_at=call.created_at,
                    updated_at=call.updated_at or call.created_at,
                    needed_at=call.needed_at,
                    target_warehouse_name=tgt_wh_name,
                    items=[ln.model_dump() for ln in call_items],
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

        eligible_wo_ids = await WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=self._OPEN_BATCHING_WO_STATUSES,
        ).values_list("id", flat=True)
        eligible_ids = [int(x) for x in eligible_wo_ids if x is not None]
        if not eligible_ids:
            return [], 0
        query = query.filter(work_order_id__in=eligible_ids)

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
        ).order_by("id").all()
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

            # 齐套率：与备料建议/工单页同口径（厂库含主仓）；无工单时退化为明细行已拣占比
            kitting_rate: Optional[float] = None
            if wo is not None:
                try:
                    line_rate, _, _, factory_rate = await self._analyze_wo_batching_shortages(
                        tenant_id, wo
                    )
                    kitting_rate = (
                        factory_rate if factory_rate is not None else line_rate
                    )
                except Exception:
                    kitting_rate = None
            if kitting_rate is None and lines:
                req_sum = sum(float(ln.required_quantity or 0) for ln in lines)
                picked_sum = sum(float(ln.picked_quantity or 0) for ln in lines)
                if req_sum > 0:
                    kitting_rate = round(min(100.0, picked_sum / req_sum * 100), 2)

            created_by_name = order.created_by_name or None
            updated_by_name = order.updated_by_name or created_by_name
            # 目标线边仓：勿用拣选源仓 warehouse_*（常为原料仓）；空则按工单解析
            tgt_wh_id = order.target_warehouse_id
            tgt_wh_name = order.target_warehouse_name
            if (not tgt_wh_id or not tgt_wh_name) and wo is not None:
                try:
                    resolved_id, resolved_name = await resolve_line_side_warehouse_for_work_order(
                        tenant_id, wo, tgt_wh_id
                    )
                    tgt_wh_id = tgt_wh_id or resolved_id
                    tgt_wh_name = tgt_wh_name or resolved_name
                except BusinessLogicError:
                    logger.warning(
                        "线边备料单未解析到目标线边仓: tenant_id={}, order_id={}",
                        tenant_id,
                        order.id,
                    )
            sku_count = int(order.total_items or 0) or len(lines)
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
                    kitting_rate=kitting_rate,
                    shortage_summary=summary or None,
                    requested_quantity=float(wo.quantity) if wo and wo.quantity else None,
                    total_items=sku_count if sku_count > 0 else None,
                    priority=wo.priority if wo and wo.priority else "normal",
                    status=order.status,
                    created_by_name=created_by_name,
                    updated_by_name=updated_by_name,
                    created_at=order.created_at,
                    updated_at=order.updated_at or order.created_at,
                    suggested_warehouse_id=tgt_wh_id,
                    suggested_warehouse_name=tgt_wh_name,
                    target_warehouse_name=tgt_wh_name,
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
            created_by_name = (
                getattr(row, "created_by_name", None)
                or row.processed_by_name
                or None
            )
            updated_by_name = (
                getattr(row, "updated_by_name", None)
                or row.processed_by_name
                or created_by_name
            )
            event_at = row.processed_at or row.updated_at or row.created_at
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
                    created_by_name=created_by_name,
                    updated_by_name=updated_by_name,
                    created_at=row.created_at or event_at,
                    updated_at=event_at,
                )
            )
        if priority:
            tasks = self._apply_task_filters(tasks, priority=priority)
            total = len(tasks)
        return tasks, total
