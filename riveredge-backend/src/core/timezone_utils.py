"""UTC 时刻与 naive / aware 互转（供 ORM、业务比较与 API 使用）。"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def now_utc() -> datetime:
    """当前 UTC（timezone-aware）。"""
    return datetime.now(timezone.utc)


def now() -> datetime:
    """与 :func:`now_utc` 相同；需业务默认时区请用 Tortoise ``timezone.now()`` 或 ``make_aware``。"""
    return now_utc()


def today_str() -> str:
    """UTC 日历日 ``YYYY-MM-DD``。"""
    return now_utc().date().isoformat()


def make_aware(dt: datetime, tz_name: str = "UTC") -> datetime:
    """将 naive ``datetime`` 标上时区；已带 ``tzinfo`` 则原样返回。"""
    if dt.tzinfo is not None:
        return dt
    key = (tz_name or "UTC").strip().upper()
    if key in ("UTC", "GMT", "Z"):
        return dt.replace(tzinfo=timezone.utc)
    return dt.replace(tzinfo=ZoneInfo(tz_name))


def to_naive_utc(dt: datetime) -> datetime:
    """转为 UTC 的 naive ``datetime``（无时区信息，便于与历史 naive 字段比较）。"""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


__all__ = ["now", "now_utc", "today_str", "make_aware", "to_naive_utc"]
