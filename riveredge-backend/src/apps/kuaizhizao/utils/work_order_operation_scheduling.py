"""工单工序计划时间：有交期锚点时倒排，否则从开始时间正排。

可选接入厂级工作时段（holidays + WorkHoursConfig）；未传 work_hours 时保持连续挂钟，兼容旧测试与调用方。
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, List, Optional, Sequence, Set, Tuple

from core.utils.timezone_utils import resolve_business_datetime
from apps.kuaizhizao.utils.working_time import (
    OvertimeByDate,
    WorkHoursConfig,
    add_working_hours,
    snap_to_previous_working_end,
    snap_to_working_start,
    subtract_working_hours,
)


def has_operation_hours(setup_time: Any, standard_time: Any) -> bool:
    """工序是否维护了可用工时（准备工时或标准工时任一有效）。"""
    try:
        setup_hours = float(setup_time) if setup_time not in (None, "") else 0.0
    except (TypeError, ValueError):
        setup_hours = 0.0
    try:
        standard_hours = float(standard_time) if standard_time not in (None, "") else 0.0
    except (TypeError, ValueError):
        standard_hours = 0.0
    return setup_hours > 0 or standard_hours > 0


def operation_total_hours(setup_time: Any, standard_time: Any, quantity: Any) -> float:
    setup_hours = float(setup_time) if setup_time else 0.0
    standard_hours_per_unit = float(standard_time) if standard_time else 0.0
    qty = float(quantity) if quantity else 1.0
    total = setup_hours + standard_hours_per_unit * qty
    # 建单/重算等路径保留正值下限；排产引擎须先用 has_operation_hours 拦截缺失
    return total if total > 0 else 1.0


def normalize_schedule_anchor(value: Any, *, end_of_day: bool = False) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        # date → 站点墙钟日界，再转 UTC（禁止把日历日当 UTC 午夜）
        wall = datetime.combine(value, time(23, 59, 59) if end_of_day else time.min)
        return resolve_business_datetime(wall)
    return resolve_business_datetime()


def build_operation_time_slots(
    durations_hours: Sequence[float],
    *,
    planned_start: Optional[Any] = None,
    planned_end: Optional[Any] = None,
    holidays: Optional[Set[date]] = None,
    work_hours: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
) -> List[Tuple[datetime, datetime]]:
    """
    生成各工序 (start, end)。
    - 有 planned_end：自交期锚点倒排，末道工序结束不晚于锚点；
    - 否则：自 planned_start 正排。
    - 传入 work_hours 时按工作日/工作时段/加班窗消耗净工时。
    """
    if not durations_hours:
        return []

    if work_hours is not None:
        return _build_slots_working_time(
            durations_hours,
            planned_start=planned_start,
            planned_end=planned_end,
            holidays=holidays,
            work_hours=work_hours,
            overtime=overtime,
        )

    if planned_end is not None:
        anchor = normalize_schedule_anchor(planned_end, end_of_day=True)
        current_end = anchor
        slots_rev: List[Tuple[datetime, datetime]] = []
        for hours in reversed(durations_hours):
            op_end = current_end
            op_start = op_end - timedelta(hours=float(hours))
            slots_rev.append((op_start, op_end))
            current_end = op_start
        slots_rev.reverse()
        return slots_rev

    start = normalize_schedule_anchor(planned_start or resolve_business_datetime(), end_of_day=False)
    current = start
    slots: List[Tuple[datetime, datetime]] = []
    for hours in durations_hours:
        op_start = current
        op_end = op_start + timedelta(hours=float(hours))
        slots.append((op_start, op_end))
        current = op_end
    return slots


def _build_slots_working_time(
    durations_hours: Sequence[float],
    *,
    planned_start: Optional[Any],
    planned_end: Optional[Any],
    holidays: Optional[Set[date]],
    work_hours: WorkHoursConfig,
    overtime: Optional[OvertimeByDate] = None,
) -> List[Tuple[datetime, datetime]]:
    if planned_end is not None:
        anchor = normalize_schedule_anchor(planned_end, end_of_day=True)
        current_end = snap_to_previous_working_end(
            anchor, holidays=holidays, config=work_hours, overtime=overtime
        )
        slots_rev: List[Tuple[datetime, datetime]] = []
        for hours in reversed(list(durations_hours)):
            op_end = current_end
            op_start = subtract_working_hours(
                op_end,
                float(hours),
                holidays=holidays,
                config=work_hours,
                overtime=overtime,
            )
            slots_rev.append((op_start, op_end))
            current_end = op_start
        slots_rev.reverse()
        return slots_rev

    start = normalize_schedule_anchor(planned_start or resolve_business_datetime(), end_of_day=False)
    current = snap_to_working_start(
        start, holidays=holidays, config=work_hours, overtime=overtime
    )
    slots: List[Tuple[datetime, datetime]] = []
    for hours in durations_hours:
        op_start = snap_to_working_start(
            current, holidays=holidays, config=work_hours, overtime=overtime
        )
        op_end = add_working_hours(
            op_start,
            float(hours),
            holidays=holidays,
            config=work_hours,
            overtime=overtime,
        )
        slots.append((op_start, op_end))
        current = op_end
    return slots
