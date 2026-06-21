"""UTC 时刻与 naive / aware 互转（供 ORM、业务比较与 API 使用）。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from infra.config.infra_config import infra_settings


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


def to_site_timezone(dt: datetime) -> datetime:
    """将 ``datetime`` 统一转换到系统配置时区。naive 值按站点墙钟解释（与 Tortoise 业务时间一致）。"""
    tz_name = infra_settings.TIMEZONE or "Asia/Shanghai"
    if dt.tzinfo is None:
        return make_aware(dt, tz_name)
    return dt.astimezone(ZoneInfo(tz_name))


def to_site_date(dt: datetime) -> date:
    """业务日历日：在站点时区下取 date（入库确认、生产日期等）。"""
    return to_site_timezone(dt).date()


def resolve_business_datetime(value: datetime | None = None) -> datetime:
    """
    业务入库/出库时刻，供 QuerySet.update 等绕过 ORM 的路径写入 DB。

    - 默认：站点当前时刻（Tortoise tz_now）
    - naive：按站点墙钟解释后转 UTC
    - aware：统一转 UTC
    """
    from tortoise.timezone import now as tz_now

    dt = value if value is not None else tz_now()
    if dt.tzinfo is None:
        dt = make_aware(dt, infra_settings.TIMEZONE or "Asia/Shanghai")
    return dt.astimezone(timezone.utc)


def to_api_isoformat(value: datetime | date | None) -> str | None:
    """
    API 输出统一格式：

    - datetime：转系统时区后输出 ``YYYY-MM-DD HH:MM:SS``
    - date：输出 ``YYYY-MM-DD``
    - None：返回 ``None``
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return to_site_timezone(value).strftime("%Y-%m-%d %H:%M:%S")
    return value.isoformat()


__all__ = [
    "now",
    "now_utc",
    "today_str",
    "make_aware",
    "to_naive_utc",
    "is_future_datetime",
    "to_site_timezone",
    "to_site_date",
    "resolve_business_datetime",
    "to_api_isoformat",
]
