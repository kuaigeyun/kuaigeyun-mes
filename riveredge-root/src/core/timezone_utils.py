"""
时区工具模块

提供统一的时区处理工具函数，确保整个项目使用统一的时区配置
时区配置从 Settings 中读取，统一管理
"""

from datetime import datetime
from typing import Optional
import pytz

from app.config import settings


# 统一时区：从 Settings 中读取，默认 Asia/Shanghai (UTC+8)
def _get_default_timezone():
    """
    获取默认时区（从 Settings 中读取）
    
    Returns:
        pytz.timezone: 默认时区对象
    """
    return pytz.timezone(settings.TIMEZONE)


# 延迟初始化，确保 settings 已加载
DEFAULT_TIMEZONE = None
UTC_TIMEZONE = pytz.UTC


def get_default_timezone():
    """
    获取默认时区（从 Settings 中读取）
    
    Returns:
        pytz.timezone: 默认时区对象
    """
    global DEFAULT_TIMEZONE
    if DEFAULT_TIMEZONE is None:
        DEFAULT_TIMEZONE = _get_default_timezone()
    return DEFAULT_TIMEZONE


def now() -> datetime:
    """
    获取当前时间（使用 Settings 中配置的默认时区）
    
    Returns:
        datetime: 当前时间的时区感知 datetime 对象
    """
    return datetime.now(get_default_timezone())


def utcnow() -> datetime:
    """
    获取当前 UTC 时间
    
    Returns:
        datetime: 当前时间的时区感知 datetime 对象（UTC）
    """
    return datetime.now(UTC_TIMEZONE)


def to_shanghai(dt: datetime) -> datetime:
    """
    将 datetime 转换为默认时区（从 Settings 中读取）
    
    Args:
        dt: 要转换的 datetime 对象（可以是 naive 或 aware）
        
    Returns:
        datetime: 默认时区的 datetime 对象
    """
    if dt is None:
        return None
    
    # 如果是 naive datetime，假设为 UTC
    if dt.tzinfo is None:
        dt = UTC_TIMEZONE.localize(dt)
    
    # 转换为默认时区
    return dt.astimezone(get_default_timezone())


def to_utc(dt: datetime) -> datetime:
    """
    将 datetime 转换为 UTC 时区
    
    Args:
        dt: 要转换的 datetime 对象（可以是 naive 或 aware）
        
    Returns:
        datetime: UTC 时区的 datetime 对象
    """
    if dt is None:
        return None
    
    # 如果是 naive datetime，假设为默认时区
    if dt.tzinfo is None:
        dt = get_default_timezone().localize(dt)
    
    # 转换为 UTC 时区
    return dt.astimezone(UTC_TIMEZONE)


def make_aware(dt: datetime, timezone_name: Optional[str] = None) -> datetime:
    """
    将 naive datetime 转换为时区感知的 datetime
    
    Args:
        dt: naive datetime 对象
        timezone_name: 时区名称（默认从 Settings 中读取）
        
    Returns:
        datetime: 时区感知的 datetime 对象
    """
    if dt is None:
        return None
    
    if dt.tzinfo is not None:
        return dt
    
    # 如果未指定时区，使用 Settings 中的默认时区
    if timezone_name is None:
        timezone_name = settings.TIMEZONE
    
    tz = pytz.timezone(timezone_name)
    return tz.localize(dt)

