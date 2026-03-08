"""
统一时区工具模块

项目内所有 datetime 操作应通过本模块，确保与数据库配置（use_tz、timezone）一致。
配置来源：infra.config.infra_config (USE_TZ, TIMEZONE)

当 use_tz=False 时：返回 naive UTC，供 Tortoise ORM 与 PostgreSQL TIMESTAMPTZ 使用。
"""

from datetime import datetime, timezone
from typing import Optional

from infra.config.infra_config import infra_settings as settings


def now_utc() -> datetime:
    """
    获取当前 UTC 时间（timezone-aware）

    用于数据库写入（created_at、updated_at、deleted_at 等）。
    asyncpg 编码 TIMESTAMPTZ 时需要 aware datetime，否则会触发
    "can't subtract offset-naive and offset-aware datetimes"。

    Returns:
        datetime: timezone-aware UTC 时间
    """
    return datetime.now(timezone.utc)


def now() -> datetime:
    """
    获取当前时间（与 now_utc 相同，用于兼容）

    当 use_tz=False 时等同于 now_utc()。
    """
    return now_utc()


def today_str(fmt: str = "%Y%m%d") -> str:
    """
    获取当前 UTC 日期的字符串（用于单据编码等）

    Args:
        fmt: 日期格式，默认 %Y%m%d

    Returns:
        str: 格式化的日期字符串
    """
    return now_utc().strftime(fmt)


def make_aware(dt: datetime, tz_name: Optional[str] = None) -> datetime:
    """
    将 naive datetime 转为时区感知（用于比较、展示等场景）

    Args:
        dt: naive datetime
        tz_name: 时区名，默认 UTC（因 DB 存 naive UTC）

    Returns:
        datetime: 时区感知的 datetime
    """
    if dt is None or dt.tzinfo is not None:
        return dt
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(tz_name or "UTC")
    return dt.replace(tzinfo=tz)


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    将任意 datetime 转为 naive UTC（用于与 now_utc() 比较）

    Args:
        dt: 任意 datetime（naive 或 aware）

    Returns:
        datetime: naive UTC
    """
    if dt is None:
        return None
    from zoneinfo import ZoneInfo
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
