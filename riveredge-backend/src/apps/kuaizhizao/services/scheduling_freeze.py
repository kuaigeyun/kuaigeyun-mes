"""可视排产冻结窗与工单锁定判定（前后端语义一致）。"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional, Union
from core.utils.timezone_utils import resolve_business_datetime


def freeze_anchor_datetime(
    freeze_horizon_days: int,
    *,
    now: Optional[datetime] = None,
) -> datetime:
    """与前端 dayjs().add(days).endOf('day') 对齐。"""
    base = now or resolve_business_datetime()
    days = max(0, int(freeze_horizon_days or 0))
    anchor_day = (base + timedelta(days=days)).replace(
        hour=23, minute=59, second=59, microsecond=999999
    )
    return anchor_day


def _as_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def is_planned_start_in_freeze_window(
    planned_start: Any,
    freeze_horizon_days: int,
    *,
    now: Optional[datetime] = None,
) -> bool:
    start = _as_datetime(planned_start)
    if not start:
        return False
    anchor = freeze_anchor_datetime(freeze_horizon_days, now=now)
    start_naive = start.replace(tzinfo=None) if start.tzinfo else start
    anchor_naive = anchor.replace(tzinfo=None) if anchor.tzinfo else anchor
    return start_naive <= anchor_naive


def work_order_is_scheduling_locked(
    work_order: Any,
    freeze_horizon_days: int,
    *,
    now: Optional[datetime] = None,
) -> bool:
    if getattr(work_order, "is_frozen", False):
        return True
    planned_start = getattr(work_order, "planned_start_date", None)
    return is_planned_start_in_freeze_window(planned_start, freeze_horizon_days, now=now)


def freeze_lock_reason(
    work_order: Any,
    freeze_horizon_days: int,
    *,
    now: Optional[datetime] = None,
) -> Optional[str]:
    if getattr(work_order, "is_frozen", False):
        return "frozen"
    if is_planned_start_in_freeze_window(
        getattr(work_order, "planned_start_date", None),
        freeze_horizon_days,
        now=now,
    ):
        return "freeze_window"
    return None
