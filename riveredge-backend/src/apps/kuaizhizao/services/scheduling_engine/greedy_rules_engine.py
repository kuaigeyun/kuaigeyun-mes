"""规则式贪心排产引擎：逾期优先、工位最早可行槽（工作日/工作时段内）。"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from tortoise.timezone import now as tz_now

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.services.rolling_schedule_service import RollingScheduleService
from apps.kuaizhizao.services.scheduling_engine.base import SchedulingPlanRequest
from apps.kuaizhizao.services.scheduling_freeze import freeze_anchor_datetime
from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.kuaizhizao.utils.work_order_operation_scheduling import (
    has_operation_hours,
    operation_total_hours,
)
from apps.kuaizhizao.utils.working_time import (
    add_working_hours,
    find_earliest_working_slot,
    find_latest_working_slot,
    load_scheduling_work_context,
    subtract_working_hours,
)
from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.utils.outsource_operation import occupies_factory_capacity
from apps.master_data.models.work_calendar import StationUnavailableWindow
from apps.master_data.models.factory import Workstation
from core.utils.timezone_utils import make_aware, site_timezone_name, to_site_timezone


PRIORITY_WEIGHT = {"urgent": 0, "high": 1, "normal": 2, "low": 3}


def _business_tz_name() -> str:
    return site_timezone_name()


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



def _timeline_3(intervals: List[Tuple]) -> List[Tuple[datetime, datetime, int]]:
    """Strip product_id for slot finder."""
    out = []
    for iv in intervals:
        if len(iv) >= 3:
            out.append((iv[0], iv[1], int(iv[2])))
    return out


def _prev_interval(timeline: List[Tuple], before: datetime) -> Optional[Tuple]:
    prev = None
    for iv in timeline:
        if iv[1] <= before and (prev is None or iv[1] > prev[1]):
            prev = iv
    return prev


def _apply_changeover_earliest(
    timeline: List[Tuple],
    earliest: datetime,
    product_id: int,
    changeover_ctx,
    *,
    production_line_id: int,
    holidays,
    work_hours,
    overtime,
) -> Tuple[datetime, Optional[str]]:
    """返回 (earliest, reason_code|None)。禁共线时 reason_code=forbid_same_line。"""
    if product_id <= 0 or not timeline:
        return earliest, None
    prev = _prev_interval(timeline, earliest)
    if prev is None:
        return earliest, None
    prev_pid = int(prev[3]) if len(prev) > 3 else 0
    if prev_pid <= 0 or prev_pid == product_id:
        return earliest, None
    hours, forbid, source = changeover_ctx.lookup(
        prev_pid, product_id, production_line_id=production_line_id or None
    )
    if forbid:
        return earliest, "forbid_same_line"
    if hours <= 0:
        return earliest, None
    ready = add_working_hours(
        prev[1],
        hours,
        holidays=holidays,
        config=work_hours,
        overtime=overtime,
    )
    if ready > earliest:
        return max(earliest, ready), f"changeover:{source}"
    return earliest, None


def _neighbor_changeover_hours(
    changeover_ctx,
    from_pid: int,
    to_pid: int,
    *,
    production_line_id: int,
    fallback_hours: float,
) -> Tuple[float, bool, str]:
    if changeover_ctx is not None:
        return changeover_ctx.lookup(
            from_pid, to_pid, production_line_id=production_line_id or None
        )
    if from_pid <= 0 or to_pid <= 0 or from_pid == to_pid:
        return 0.0, False, "same"
    if fallback_hours > 0:
        return float(fallback_hours), False, "fallback"
    return 0.0, False, "none"


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
        span_days = max(120, int(constraints.get("rolling_horizon_days", 14)) * 3)
        holidays, work_hours, overtime = await load_scheduling_work_context(
            tenant_id, around=anchor_day, span_days=span_days
        )
        changeover_hours = float(constraints.get("setup_changeover_hours") or 0.0)
        schedule_mode = str(constraints.get("schedule_mode") or "forward").strip().lower()
        material_hard = bool(constraints.get("material_hard_constraint"))
        resource_mode = str(constraints.get("resource_mode") or "workstation").strip().lower()
        line_exclusive = bool(constraints.get("line_exclusive", True))
        use_line_resource = resource_mode == "production_line"
        station_rows = await Workstation.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).values("id", "max_parallel", "production_line_id")
        station_parallel = {
            int(r["id"]): max(1, int(r.get("max_parallel") or 1)) for r in station_rows
        }
        station_to_line = {
            int(r["id"]): int(r.get("production_line_id") or 0) for r in station_rows
        }

        # 锚点为业务墙钟（厂级上班时刻），须按站点时区 make_aware，不可走 to_site_timezone（naive=UTC）
        anchor_start = make_aware(
            datetime.combine(anchor_day, work_hours.start),
            _business_tz_name(),
        )

        candidate_ids = await self._resolve_candidate_ids(tenant_id, request, now)
        if not candidate_ids:
            return {
                "summary": "无可重排工单",
                "warnings": ["未找到符合范围的工单"],
                "reasons": [],
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
        candidate_op_ids = set()
        for wo in wos:
            for op in await WorkOrderOperation.filter(
                tenant_id=tenant_id, work_order_id=wo.id, deleted_at__isnull=True
            ).all():
                if op.status not in {"completed", "cancelled"}:
                    candidate_op_ids.add(int(op.id))

        # (start, end, op_id, product_id)；产线模式下 key 为 production_line_id
        resource_timeline: Dict[int, List[Tuple[datetime, datetime, int, int]]] = defaultdict(list)
        existing_wo_ids = list({int(op.work_order_id) for op in existing_ops if op.work_order_id})
        product_by_wo: Dict[int, int] = {}
        if existing_wo_ids:
            for row in await WorkOrder.filter(tenant_id=tenant_id, id__in=existing_wo_ids).values("id", "product_id"):
                product_by_wo[int(row["id"])] = int(row.get("product_id") or 0)
        active_outsource_op_ids: Set[int] = set(
            await OutsourceOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            .exclude(status="cancelled")
            .values_list("work_order_operation_id", flat=True)
        )

        def _resource_key(station_id: int) -> int:
            if not use_line_resource:
                return station_id
            line_id = station_to_line.get(station_id, 0)
            return line_id if line_id > 0 else station_id

        def _resource_capacity(station_id: int) -> int:
            if use_line_resource and line_exclusive:
                return 1
            return station_parallel.get(station_id, 1)

        for op in existing_ops:
            sid = int(op.assigned_station_id or 0)
            if sid <= 0 or not op.planned_start_date or not op.planned_end_date:
                continue
            if not occupies_factory_capacity(
                op, has_active_outsource_order=int(op.id) in active_outsource_op_ids
            ):
                continue
            # 将被重排的工序从占用时间线中排除，避免自己挡自己
            if int(op.id) in candidate_op_ids:
                continue
            rkey = _resource_key(sid)
            if use_line_resource and station_to_line.get(sid, 0) <= 0:
                continue
            resource_timeline[rkey].append(
                (
                    _scheduling_dt(op.planned_start_date),
                    _scheduling_dt(op.planned_end_date),
                    int(op.id),
                    product_by_wo.get(int(op.work_order_id or 0), 0),
                )
            )

        downtime_rows = await StationUnavailableWindow.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        for row in downtime_rows:
            sid = int(row.station_id or 0)
            if sid <= 0 or not row.start_at or not row.end_at:
                continue
            rkey = _resource_key(sid)
            resource_timeline[rkey].append(
                (
                    _scheduling_dt(row.start_at),
                    _scheduling_dt(row.end_at),
                    0,
                    0,
                )
            )

        product_ids: Set[int] = set(product_by_wo.values())
        for wo in wos:
            pid = int(wo.product_id or 0)
            if pid > 0:
                product_ids.add(pid)
                product_by_wo[int(wo.id)] = pid
        changeover_ctx = None
        try:
            from apps.ind_relay.services.changeover_lookup import load_changeover_context

            changeover_ctx = await load_changeover_context(
                tenant_id,
                fallback_hours=changeover_hours,
                product_ids=product_ids,
            )
        except Exception:
            changeover_ctx = None

        proposals: Dict[str, Any] = {
            "summary": None,
            "warnings": [],
            "reasons": [],
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

            if material_hard:
                readiness = getattr(wo, "readiness_rate", None)
                try:
                    rate = float(readiness) if readiness is not None else 100.0
                except (TypeError, ValueError):
                    rate = 100.0
                if rate < 100.0:
                    proposals["warnings"].append(
                        f"工单 {wo.code} 物料未齐套（{rate}%），硬约束跳过"
                    )
                    continue

            place_backward = (
                schedule_mode == "backward" and wo.planned_end_date is not None
            )
            if place_backward:
                due = _scheduling_dt(wo.planned_end_date)
                cursor = max(freeze_anchor, due)
            else:
                cursor = max(anchor_start, freeze_anchor)
            wo_op_slots: List[Tuple[WorkOrderOperation, datetime, datetime, int]] = []
            op_iter = list(reversed(pending)) if place_backward else pending

            for op in op_iter:
                is_outsource = not occupies_factory_capacity(
                    op, has_active_outsource_order=int(op.id) in active_outsource_op_ids
                )
                if is_outsource:
                    lead_days = int(getattr(op, "outsource_lead_time_days", None) or 1)
                    lead_days = max(0, lead_days)
                    if place_backward:
                        end = cursor
                        start = end - timedelta(days=lead_days if lead_days > 0 else 0)
                        if start < freeze_anchor:
                            start = freeze_anchor
                            end = start + timedelta(days=lead_days if lead_days > 0 else 0)
                        wo_op_slots.insert(0, (op, start, end, 0))
                        cursor = start
                    else:
                        start = cursor
                        end = start + timedelta(days=lead_days if lead_days > 0 else 0)
                        wo_op_slots.append((op, start, end, 0))
                        cursor = end
                    continue

                if not has_operation_hours(op.setup_time, op.standard_time):
                    proposals["warnings"].append(
                        f"工单 {wo.code} 工序 {op.operation_name or op.operation_code or op.id} "
                        f"缺少工序工时（setup_time/standard_time），请先补齐后重排"
                    )
                    wo_op_slots = []
                    break
                duration_hours = operation_total_hours(op.setup_time, op.standard_time, wo.quantity)
                station_id = int(op.assigned_station_id or 0)
                if station_id <= 0:
                    station_id = await self._resolve_default_station_id(tenant_id, op)
                if station_id <= 0:
                    proposals["warnings"].append(
                        f"工单 {wo.code} 工序 {op.operation_name} 无可用工位，跳过"
                    )
                    wo_op_slots = []
                    break

                product_id = int(wo.product_id or 0)
                if use_line_resource and station_to_line.get(station_id, 0) <= 0:
                    proposals["warnings"].append(
                        f"工单 {wo.code} 工序 {op.operation_name} 工位未绑定产线，产线排程模式下跳过"
                    )
                    wo_op_slots = []
                    break
                rkey = _resource_key(station_id)
                line_id = station_to_line.get(station_id, 0) if use_line_resource else 0
                timeline = resource_timeline.get(rkey, [])
                capacity = _resource_capacity(station_id)
                earliest = cursor
                try:
                    start = end = None
                    if place_backward:
                        latest = cursor
                        for _attempt in range(40):
                            start, end = find_latest_working_slot(
                                _timeline_3(timeline),
                                latest,
                                duration_hours,
                                holidays=holidays,
                                config=work_hours,
                                overtime=overtime,
                                exclude_op_id=int(op.id),
                                max_parallel=capacity,
                            )
                            nxt = None
                            for iv in timeline:
                                if iv[0] >= end and (nxt is None or iv[0] < nxt[0]):
                                    nxt = iv
                            if nxt and product_id > 0:
                                nxt_pid = int(nxt[3] if len(nxt) > 3 else 0)
                                ch_hours, forbid, source = _neighbor_changeover_hours(
                                    changeover_ctx,
                                    product_id,
                                    nxt_pid,
                                    production_line_id=line_id or rkey,
                                    fallback_hours=changeover_hours,
                                )
                                if forbid:
                                    proposals["warnings"].append(
                                        f"工单 {wo.code} 工序 {op.operation_name} 与后续产品禁共线，跳过"
                                    )
                                    proposals["reasons"].append(
                                        {
                                            "code": "forbid_same_line",
                                            "work_order_id": int(wo.id),
                                            "operation_id": int(op.id),
                                            "message": "料号族禁共线，无法倒排到该资源",
                                        }
                                    )
                                    raise ValueError("禁共线")
                                if ch_hours > 0 and nxt_pid not in (0, product_id):
                                    ready = add_working_hours(
                                        end,
                                        ch_hours,
                                        holidays=holidays,
                                        config=work_hours,
                                        overtime=overtime,
                                    )
                                    if ready > nxt[0]:
                                        latest = subtract_working_hours(
                                            nxt[0],
                                            ch_hours,
                                            holidays=holidays,
                                            config=work_hours,
                                            overtime=overtime,
                                        )
                                        continue
                            break
                    else:
                        for _attempt in range(40):
                            if changeover_ctx is not None:
                                earliest, ch_reason = _apply_changeover_earliest(
                                    timeline,
                                    earliest,
                                    product_id,
                                    changeover_ctx,
                                    production_line_id=line_id or rkey,
                                    holidays=holidays,
                                    work_hours=work_hours,
                                    overtime=overtime,
                                )
                                if ch_reason == "forbid_same_line":
                                    proposals["warnings"].append(
                                        f"工单 {wo.code} 工序 {op.operation_name} 与前序产品禁共线，跳过"
                                    )
                                    proposals["reasons"].append(
                                        {
                                            "code": "forbid_same_line",
                                            "work_order_id": int(wo.id),
                                            "operation_id": int(op.id),
                                            "message": "料号族禁共线，无法排到该资源",
                                        }
                                    )
                                    raise ValueError("禁共线")
                            else:
                                ch_reason = None
                                if changeover_hours > 0 and product_id > 0:
                                    prev = _prev_interval(timeline, earliest)
                                    if prev and int(prev[3] if len(prev) > 3 else 0) not in (
                                        0,
                                        product_id,
                                    ):
                                        earliest = add_working_hours(
                                            prev[1],
                                            changeover_hours,
                                            holidays=holidays,
                                            config=work_hours,
                                            overtime=overtime,
                                        )
                                        ch_reason = "changeover:fallback"
                            start, end = find_earliest_working_slot(
                                _timeline_3(timeline),
                                earliest,
                                duration_hours,
                                holidays=holidays,
                                config=work_hours,
                                overtime=overtime,
                                exclude_op_id=int(op.id),
                                max_parallel=capacity,
                            )
                            prev = _prev_interval(timeline, start)
                            if prev and product_id > 0:
                                prev_pid = int(prev[3] if len(prev) > 3 else 0)
                                ch_hours, forbid, source = _neighbor_changeover_hours(
                                    changeover_ctx,
                                    prev_pid,
                                    product_id,
                                    production_line_id=line_id or rkey,
                                    fallback_hours=changeover_hours,
                                )
                                if forbid:
                                    proposals["warnings"].append(
                                        f"工单 {wo.code} 工序 {op.operation_name} 与前序产品禁共线，跳过"
                                    )
                                    proposals["reasons"].append(
                                        {
                                            "code": "forbid_same_line",
                                            "work_order_id": int(wo.id),
                                            "operation_id": int(op.id),
                                            "message": "料号族禁共线，无法排到该资源",
                                        }
                                    )
                                    raise ValueError("禁共线")
                                if ch_hours > 0 and prev_pid not in (0, product_id):
                                    ready = add_working_hours(
                                        prev[1],
                                        ch_hours,
                                        holidays=holidays,
                                        config=work_hours,
                                        overtime=overtime,
                                    )
                                    if start < ready:
                                        earliest = ready
                                        continue
                                    if ch_reason and ch_reason.startswith("changeover:"):
                                        proposals["reasons"].append(
                                            {
                                                "code": ch_reason,
                                                "work_order_id": int(wo.id),
                                                "operation_id": int(op.id),
                                                "message": (
                                                    f"插入换型 {ch_hours:g}h（来源 {source}）"
                                                ),
                                                "changeover_hours": ch_hours,
                                            }
                                        )
                            break
                    if start is None or end is None:
                        raise ValueError("无法找到可行槽位")
                except ValueError as e:
                    proposals["warnings"].append(
                        f"工单 {wo.code} 工序 {op.operation_name} 无法安排工作时段：{e}"
                    )
                    if str(e) != "禁共线":
                        proposals["reasons"].append(
                            {
                                "code": "no_slot",
                                "work_order_id": int(wo.id),
                                "operation_id": int(op.id),
                                "message": str(e),
                            }
                        )
                    wo_op_slots = []
                    break

                if place_backward:
                    wo_op_slots.insert(0, (op, start, end, station_id))
                    cursor = start
                else:
                    wo_op_slots.append((op, start, end, station_id))
                    cursor = end
                resource_timeline[rkey].append((start, end, int(op.id), product_id))

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
                if station_id > 0 and int(op.assigned_station_id or 0) != station_id:
                    proposals["operation_station_adjustments"].append(
                        {
                            "operation_id": int(op.id),
                            "assigned_station_id": station_id,
                        }
                    )

            wo_start = wo_op_slots[0][1]
            wo_end = wo_op_slots[-1][2]
            if place_backward and wo.planned_end_date:
                due = _scheduling_dt(wo.planned_end_date)
                if wo_end > due:
                    proposals["warnings"].append(
                        f"工单 {wo.code} 倒排无法满足交期，最早可行完工 {wo_end.isoformat()}"
                    )
            proposals["work_order_adjustments"].append(
                {
                    "work_order_id": int(wo.id),
                    "planned_start_date": wo_start.isoformat(),
                    "planned_end_date": wo_end.isoformat(),
                }
            )
            scheduled_wo += 1

        proposals["summary"] = (
            f"规则引擎已为 {scheduled_wo} 张工单生成排产提案（锚点 {anchor_day}"
            f"{'，含换型矩阵' if changeover_ctx and changeover_ctx.available else ''}）"
        )
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

        if scope == "local":
            return await self._resolve_local_candidate_ids(tenant_id, request, now)

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

    async def _resolve_local_candidate_ids(
        self,
        tenant_id: int,
        request: SchedulingPlanRequest,
        now: datetime,
    ) -> List[int]:
        """局部重排：种子工单 + 同资源时间窗内邻域工单。"""
        window_hours = float(getattr(request, "local_window_hours", None) or 24)
        window_hours = max(1.0, min(window_hours, 168.0))
        seed_ids = [int(i) for i in (request.work_order_ids or []) if int(i) > 0]
        if not seed_ids:
            # 无种子时取当前时刻附近已排工单
            window_end = now + timedelta(hours=window_hours)
            near_ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                planned_start_date__lte=window_end,
                planned_end_date__gte=now,
                assigned_station_id__gt=0,
            ).limit(80)
            seed_ids = list({int(op.work_order_id) for op in near_ops if op.work_order_id})[:20]
        if not seed_ids:
            return []

        seed_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=seed_ids,
            deleted_at__isnull=True,
            assigned_station_id__gt=0,
        ).all()
        station_ids = {int(op.assigned_station_id) for op in seed_ops if op.assigned_station_id}
        resource_ids = {int(i) for i in (getattr(request, "resource_ids", None) or []) if int(i) > 0}
        if resource_ids:
            station_ids |= resource_ids
            # 产线 id 也可能传入：扩展为线内工位
            line_stations = await Workstation.filter(
                tenant_id=tenant_id,
                production_line_id__in=list(resource_ids),
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
            station_ids |= {int(i) for i in line_stations}

        if not station_ids:
            return seed_ids[:50]

        window_end = now + timedelta(hours=window_hours)
        neighbor_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            assigned_station_id__in=list(station_ids),
            planned_start_date__lte=window_end,
            planned_end_date__gte=now - timedelta(hours=window_hours),
        ).all()
        ids = set(seed_ids)
        for op in neighbor_ops:
            if op.work_order_id:
                ids.add(int(op.work_order_id))
        return list(ids)[:50]

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
