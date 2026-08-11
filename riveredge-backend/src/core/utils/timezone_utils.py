"""全站时区唯一工具（写入 / 比较 / API 展示口径）。

契约见 ``.cursor/rules/timezone-contract.mdc``。
业务时刻写入只用 :func:`resolve_business_datetime`；禁止 ``datetime.now()``。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from infra.config.infra_config import infra_settings


def site_timezone_name() -> str:
    """站点时区名：仅来自 ``infra_settings.TIMEZONE``（配置真源）。"""
    name = (infra_settings.TIMEZONE or "").strip()
    if not name:
        raise RuntimeError("infra_settings.TIMEZONE 未配置，拒绝静默假定时区")
    return name


def now_utc() -> datetime:
    """当前 UTC（timezone-aware）。系统戳 / 比较用。"""
    return datetime.now(timezone.utc)


def now() -> datetime:
    """与 :func:`now_utc` 相同。"""
    return now_utc()


def today_str() -> str:
    """UTC 日历日 ``YYYY-MM-DD``（非业务单号日期；业务请用 :func:`today_site_str`）。"""
    return now_utc().date().isoformat()


def today_site_str(fmt: str = "%Y%m%d") -> str:
    """站点时区下的业务日历串（单号前缀、业务日等）。"""
    return to_site_timezone(now_utc()).strftime(fmt)


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
    naive_tz: str | None = None,
) -> bool:
    """
    判断 ``dt`` 是否明显晚于当前 UTC 时刻。

    - aware：按瞬时 UTC 比较
    - naive：按站点时区（或显式 ``naive_tz``）解释
    """
    if dt.tzinfo is None:
        aware = make_aware(dt, naive_tz or site_timezone_name())
    else:
        aware = dt
    limit = now_utc() + timedelta(seconds=slack_seconds)
    return aware.astimezone(timezone.utc) > limit


def to_site_timezone(dt: datetime) -> datetime:
    """
    将 ``datetime`` 转换到系统配置时区。

    naive 按 **UTC** 解释（与 ``BaseSchema`` / Tortoise ``USE_TZ`` 落库口径一致）；
    业务表单墙钟入参请用 :func:`resolve_business_datetime`，勿走本函数。
    """
    if dt.tzinfo is None:
        aware = make_aware(dt, "UTC")
    else:
        aware = dt
    return aware.astimezone(ZoneInfo(site_timezone_name()))


def to_site_date(dt: datetime) -> date:
    """业务日历日：在站点时区下取 date（入库确认、生产日期等）。"""
    return to_site_timezone(dt).date()


def coerce_business_datetime_to_utc(value: datetime | None) -> datetime | None:
    """
    业务表单/推单墙钟 → ORM 写入用的 UTC aware。

    - None 保持 None
    - naive：按站点时区解释
    - aware：转到 UTC
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = make_aware(value, site_timezone_name())
    return value.astimezone(timezone.utc)


def resolve_business_datetime(value: datetime | None = None) -> datetime:
    """
    业务时刻唯一写入入口（入库/出库/审核/检验等）。

    - 默认：当前 UTC 瞬时（``now_utc``，不依赖 Tortoise ``timezone.now`` / 环境变量）
    - naive：按站点墙钟解释后转 UTC
    - aware：统一转 UTC

    禁止把 ``datetime.now()`` 裸 naive 交给 ORM ``QuerySet.update``：
    Tortoise 在 USE_TZ 下会把 naive **标成 UTC**（而非按站点解释），导致展示 +8h。
    """
    if value is None:
        return now_utc()
    coerced = coerce_business_datetime_to_utc(value)
    assert coerced is not None
    return coerced


def site_period_bounds_utc(period: str) -> tuple[datetime, datetime]:
    """站点日历月 [start, end) 转为 UTC aware，供报工/绩效按周期聚合。"""
    year, month = map(int, period.split("-"))
    tz = ZoneInfo(site_timezone_name())
    start = datetime(year, month, 1, tzinfo=tz)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=tz)
    else:
        end = datetime(year, month + 1, 1, tzinfo=tz)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def site_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """站点日历日 [start, end) 转为 UTC aware，供报表按日筛选。"""
    tz = ZoneInfo(site_timezone_name())
    start = datetime(day.year, day.month, day.day, tzinfo=tz)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


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
    "site_timezone_name",
    "now",
    "now_utc",
    "today_str",
    "today_site_str",
    "make_aware",
    "to_naive_utc",
    "is_future_datetime",
    "to_site_timezone",
    "to_site_date",
    "coerce_business_datetime_to_utc",
    "resolve_business_datetime",
    "site_period_bounds_utc",
    "site_day_bounds_utc",
    "to_api_isoformat",
]
