"""规则式贪心排产引擎：逾期优先、工位最早可行槽。"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from tortoise.timezone import now as tz_now

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.services.rolling_schedule_service import RollingScheduleService
from apps.kuaizhizao.services.scheduling_engine.base import SchedulingPlanRequest
from apps.kuaizhizao.services.scheduling_freeze import freeze_anchor_datetime
from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService, _intervals_overlap
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.kuaizhizao.utils.work_order_operation_scheduling import (
    build_operation_time_slots,
    has_operation_hours,
    operation_total_hours,
)
from apps.master_data.models.factory import Workstation
from core.utils.timezone_utils import make_aware, to_site_timezone
from infra.config.infra_config import infra_settings


PRIORITY_WEIGHT = {"urgent": 0, "high": 1, "normal": 2, "low": 3}


def _business_tz_name() -> str:
    return infra_settings.TIMEZONE or "Asia/Shanghai"


def _scheduling_dt(value: datetime) -> datetime:
    """统一为业务时区 aware，便于与 ORM DatetimeField 比较。"""
    return to_site_timezone(value)


def _plan_day_bounds(plan_date: date) -> Tuple[datetime, datetime]:
    tz_name = _business_tz_name()
    start = make_aware(datetime.combine(plan_date, datetime.min.time()), tz_name)
    end = make_aware(datetime.combine(plan_date, datetime.max.time()), tz_name)
    return start, end


def _is_schedulable_status(wo: WorkOrder) -> bool:
    return wo.status in {"released", "in_progress", "draft"}


def _is_overdue(wo: WorkOrder, now: datetime) -> bool:
    if wo.status in {"completed", "cancelled"}:
        return False
    planned_end = _scheduling_dt(wo.planned_end_date) if wo.planned_end_date else None
    return bool(planned_end and planned_end < now)


class GreedyRulesSchedulingEngine:
    async def plan(self, request: SchedulingPlanRequest) -> Dict[str, Any]:
        tenant_id = request.tenant_id
        now = tz_now()
        vs = VisualSchedulingService()
        constraints = await vs._load_constraints(tenant_id)
        freeze_days = int(constraints.get("freeze_horizon_days", 0))
        now_business = to_site_timezone(now)
        freeze_anchor = make_aware(
            freeze_anchor_datetime(freeze_days, now=now_business.replace(tzinfo=None)),
            _business_tz_name(),
        ) + timedelta(seconds=1)

        rolling_svc = RollingScheduleService()
        anchor_day = request.plan_date or await rolling_svc.get_next_workday(
            tenant_id, to_site_timezone(now).date()
        )
        anchor_start = _scheduling_dt(
            datetime.combine(anchor_day, datetime.min.time().replace(hour=8))
        )

        candidate_ids = await self._resolve_candidate_ids(tenant_id, request, now)
        if not candidate_ids:
            return {
                "summary": "无可重排工单",
                "warnings": ["未找到符合范围的工单"],
                "unfreezed": [],
                "work_order_adjustments": [],
                "operation_adjustments": [],
                "operation_station_adjustments": [],
            }

        wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=candidate_ids,
            deleted_at__isnull=True,
        ).all()
        score_map = await WorkOrderScoreService().batch_get_scores(
            tenant_id, [w.id for w in wos], "scheduling"
        )

        def sort_key(wo: WorkOrder) -> Tuple[int, int, float, int]:
            delay = 0
            planned_end = _scheduling_dt(wo.planned_end_date) if wo.planned_end_date else None
            if planned_end and planned_end < now:
                delay = (now - planned_end).days
            pri = PRIORITY_WEIGHT.get(str(wo.priority or "normal"), 2)
            cached = score_map.get(wo.id)
            score = float(cached.composite_score) if cached and cached.composite_score is not None else 0.0
            return (-delay, pri, -score, wo.id)

        wos.sort(key=sort_key)

        existing_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_start_date__isnull=False,
            planned_end_date__isnull=False,
            assigned_station_id__gt=0,
        ).all()
        station_timeline: Dict[int, List[Tuple[datetime, datetime, int]]] = defaultdict(list)
        for op in existing_ops:
            sid = int(op.assigned_station_id or 0)
            if sid > 0 and op.planned_start_date and op.planned_end_date:
                station_timeline[sid].append(
                    (
                        _scheduling_dt(op.planned_start_date),
                        _scheduling_dt(op.planned_end_date),
                        int(op.id),
                    )
                )

        proposals: Dict[str, Any] = {
            "summary": None,
            "warnings": [],
            "unfreezed": [],
            "work_order_adjustments": [],
            "operation_adjustments": [],
            "operation_station_adjustments": [],
        }
        scheduled_wo = 0

        for wo in wos:
            if not _is_schedulable_status(wo):
                proposals["warnings"].append(f"工单 {wo.code} 状态不可排，跳过")
                continue
            if wo.is_frozen:
                if _is_overdue(wo, now) and request.updated_by:
                    wo.is_frozen = False
                    wo.updated_by = int(request.updated_by)
                    await wo.save(update_fields=["is_frozen", "updated_by", "updated_at"])
                    proposals["unfreezed"].append(int(wo.id))
                    proposals["warnings"].append(f"工单 {wo.code} 已逾期，已自动解冻并纳入重排")
                else:
                    proposals["warnings"].append(f"工单 {wo.code} 已冻结，跳过")
                    continue

            ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=wo.id,
                deleted_at__isnull=True,
            ).order_by("sequence").all()
            pending = [op for op in ops if op.status not in {"completed", "cancelled"}]
            if not pending:
                continue

            cursor = max(anchor_start, freeze_anchor)
            wo_op_slots: List[Tuple[WorkOrderOperation, datetime, datetime, int]] = []

            for op in pending:
                if not has_operation_hours(op.setup_time, op.standard_time):
                    proposals["warnings"].append(
                        f"工单 {wo.code} 工序 {op.operation_name or op.operation_code or op.id} "
                        f"缺少工序工时（setup_time/standard_time），请先补齐后重排"
                    )
                    wo_op_slots = []
                    break
                duration_hours = operation_total_hours(op.setup_time, op.standard_time, wo.quantity)
                duration = timedelta(hours=duration_hours)
                station_id = int(op.assigned_station_id or 0)
                if station_id <= 0:
                    station_id = await self._resolve_default_station_id(tenant_id, op)
                if station_id <= 0:
                    proposals["warnings"].append(
                        f"工单 {wo.code} 工序 {op.operation_name} 无可用工位，跳过"
                    )
                    wo_op_slots = []
                    break

                start, end = self._find_earliest_slot(
                    station_timeline.get(station_id, []),
                    cursor,
                    duration,
                    exclude_op_id=int(op.id),
                )
                if start < cursor:
                    start = cursor
                    end = start + duration
                wo_op_slots.append((op, start, end, station_id))
                cursor = end
                station_timeline[station_id].append((start, end, int(op.id)))

            if not wo_op_slots:
                continue

            for op, start, end, station_id in wo_op_slots:
                proposals["operation_adjustments"].append(
                    {
                        "operation_id": int(op.id),
                        "planned_start_date": start.isoformat(),
                        "planned_end_date": end.isoformat(),
                    }
                )
                if int(op.assigned_station_id or 0) != station_id:
                    proposals["operation_station_adjustments"].append(
                        {
                            "operation_id": int(op.id),
                            "assigned_station_id": station_id,
                        }
                    )

            wo_start = wo_op_slots[0][1]
            wo_end = wo_op_slots[-1][2]
            proposals["work_order_adjustments"].append(
                {
                    "work_order_id": int(wo.id),
                    "planned_start_date": wo_start.isoformat(),
                    "planned_end_date": wo_end.isoformat(),
                }
            )
            scheduled_wo += 1

        proposals["summary"] = f"规则引擎已为 {scheduled_wo} 张工单生成排产提案（锚点 {anchor_day}）"
        return proposals

    async def _resolve_candidate_ids(
        self,
        tenant_id: int,
        request: SchedulingPlanRequest,
        now: datetime,
    ) -> List[int]:
        scope = str(request.scope or "selected").strip()
        if scope == "selected" and request.work_order_ids:
            return [int(i) for i in request.work_order_ids if int(i) > 0][:50]

        query = WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["released", "in_progress"],
            deleted_at__isnull=True,
        )
        if request.plan_date:
            day_start, day_end = _plan_day_bounds(request.plan_date)
            query = query.filter(planned_start_date__gte=day_start, planned_start_date__lte=day_end)

        wos = await query.all()
        ids: List[int] = []
        for wo in wos:
            if scope == "overdue":
                planned_end = _scheduling_dt(wo.planned_end_date) if wo.planned_end_date else None
                if planned_end and planned_end < now:
                    ids.append(int(wo.id))
            elif scope == "unscheduled":
                if not wo.planned_start_date or not wo.planned_end_date:
                    ids.append(int(wo.id))
                else:
                    ops = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=wo.id,
                        deleted_at__isnull=True,
                    ).all()
                    if any(
                        (not op.planned_start_date or not op.planned_end_date or not op.assigned_station_id)
                        and op.status not in {"completed", "cancelled"}
                        for op in ops
                    ):
                        ids.append(int(wo.id))
            else:
                ids.append(int(wo.id))
        if request.work_order_ids:
            allowed = {int(i) for i in request.work_order_ids}
            ids = [i for i in ids if i in allowed]
        return ids[:50]

    @staticmethod
    async def _resolve_default_station_id(tenant_id: int, op: WorkOrderOperation) -> int:
        wc_id = int(op.work_center_id or 0)
        if wc_id > 0:
            station = await Workstation.filter(
                tenant_id=tenant_id,
                work_center_id=wc_id,
                deleted_at__isnull=True,
                is_active=True,
            ).order_by("id").first()
            if station:
                return int(station.id)
        station = await Workstation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).order_by("id").first()
        return int(station.id) if station else 0

    @staticmethod
    def _find_earliest_slot(
        intervals: List[Tuple[datetime, datetime, int]],
        earliest: datetime,
        duration: timedelta,
        *,
        exclude_op_id: int,
    ) -> Tuple[datetime, datetime]:
        cursor = earliest
        sorted_iv = sorted(
            [(s, e) for s, e, oid in intervals if oid != exclude_op_id],
            key=lambda x: x[0],
        )
        for start, end in sorted_iv:
            if cursor + duration <= start:
                return cursor, cursor + duration
            if _intervals_overlap(cursor, cursor + duration, start, end):
                cursor = max(cursor, end)
        return cursor, cursor + duration
