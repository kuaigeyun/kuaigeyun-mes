"""
工作日历辅助：基于主数据节假日（Holiday）跳过非工作日。

周末是否休息取决于是否已导入/维护为 Holiday（如 import-cn 的「周休」）。
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Optional, Set


def is_workday(d: date, holidays: Optional[Set[date]] = None) -> bool:
    if holidays and d in holidays:
        return False
    return True


def add_workdays(
    start: date,
    days: int,
    holidays: Optional[Set[date]] = None,
    *,
    max_scan_days: int = 3660,
) -> date:
    """从 start 起向前推进 days 个工作日（days=0 返回 start）。"""
    days = int(days or 0)
    if days < 0:
        return subtract_workdays(start, -days, holidays, max_scan_days=max_scan_days)
    if days == 0:
        return start
    cursor = start
    remaining = days
    for _ in range(max_scan_days):
        cursor += timedelta(days=1)
        if is_workday(cursor, holidays):
            remaining -= 1
            if remaining <= 0:
                return cursor
    raise ValueError(f"自 {start} 起 {max_scan_days} 天内无法推进 {days} 个工作日")


def subtract_workdays(
    start: date,
    days: int,
    holidays: Optional[Set[date]] = None,
    *,
    max_scan_days: int = 3660,
) -> date:
    """从 start 起向后回退 days 个工作日（days=0 返回 start）。"""
    days = int(days or 0)
    if days <= 0:
        return start
    cursor = start
    remaining = days
    for _ in range(max_scan_days):
        cursor -= timedelta(days=1)
        if is_workday(cursor, holidays):
            remaining -= 1
            if remaining <= 0:
                return cursor
    raise ValueError(f"自 {start} 起向前 {max_scan_days} 天内无法回退 {days} 个工作日")


def workdays_between(
    start: date,
    end: date,
    holidays: Optional[Set[date]] = None,
) -> int:
    """半开区间 [start, end) 内的工作日数；end<=start 时为 0。"""
    if end <= start:
        return 0
    n = 0
    cursor = start
    while cursor < end:
        if is_workday(cursor, holidays):
            n += 1
        cursor += timedelta(days=1)
    return n


def holiday_span_for_mrp(
    today: date,
    demand_dates: Iterable[date],
    max_lead_days: int,
    *,
    pad_days: int = 60,
) -> tuple[date, date]:
    """估算加载节假日的日期范围。"""
    dates = [d for d in demand_dates if isinstance(d, date)]
    end = max(dates) if dates else today
    start = today - timedelta(days=max(0, int(max_lead_days)) + pad_days)
    end = end + timedelta(days=pad_days)
    if end < start:
        end = start
    return start, end


async def load_holiday_dates(
    tenant_id: int,
    from_date: date,
    to_date: date,
) -> Set[date]:
    from apps.master_data.models.performance import Holiday

    if to_date < from_date:
        from_date, to_date = to_date, from_date
    rows = await Holiday.filter(
        tenant_id=tenant_id,
        holiday_date__gte=from_date,
        holiday_date__lte=to_date,
        is_active=True,
        deleted_at__isnull=True,
    ).all()
    return {r.holiday_date for r in rows if r.holiday_date}
