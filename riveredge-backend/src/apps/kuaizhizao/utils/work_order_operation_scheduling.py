"""工单工序计划时间：有交期锚点时倒排，否则从开始时间正排。"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, List, Optional, Sequence, Tuple


def operation_total_hours(setup_time: Any, standard_time: Any, quantity: Any) -> float:
    setup_hours = float(setup_time) if setup_time else 0.0
    standard_hours_per_unit = float(standard_time) if standard_time else 0.0
    qty = float(quantity) if quantity else 1.0
    total = setup_hours + standard_hours_per_unit * qty
    return total if total > 0 else 1.0


def normalize_schedule_anchor(value: Any, *, end_of_day: bool = False) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        if end_of_day:
            return datetime.combine(value, time(23, 59, 59))
        return datetime.combine(value, time.min)
    return datetime.now()


def build_operation_time_slots(
    durations_hours: Sequence[float],
    *,
    planned_start: Optional[Any] = None,
    planned_end: Optional[Any] = None,
) -> List[Tuple[datetime, datetime]]:
    """
    生成各工序 (start, end)。
    - 有 planned_end：自交期锚点倒排，末道工序结束不晚于锚点；
    - 否则：自 planned_start 正排。
    """
    if not durations_hours:
        return []
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

    start = normalize_schedule_anchor(planned_start or datetime.now(), end_of_day=False)
    current = start
    slots: List[Tuple[datetime, datetime]] = []
    for hours in durations_hours:
        op_start = current
        op_end = op_start + timedelta(hours=float(hours))
        slots.append((op_start, op_end))
        current = op_end
    return slots
