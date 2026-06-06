"""UTC 时刻与 naive / aware 互转（供 ORM、业务比较与 API 使用）。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
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


def is_future_datetime(
    dt: datetime,
    *,
    slack_seconds: int = 60,
    naive_tz: str = "Asia/Shanghai",
) -> bool:
    """
    判断 ``dt`` 是否明显晚于当前 UTC 时刻。

    - aware：按瞬时 UTC 比较
    - naive：按 ``naive_tz`` 解释（默认业务时区 Asia/Shanghai），避免 UTC 服务器将本地墙钟误判为未来
    """
    if dt.tzinfo is None:
        aware = make_aware(dt, naive_tz)
    else:
        aware = dt
    limit = now_utc() + timedelta(seconds=slack_seconds)
    return aware.astimezone(timezone.utc) > limit


__all__ = [
    "now",
    "now_utc",
    "today_str",
    "make_aware",
    "to_naive_utc",
    "is_future_datetime",
]
