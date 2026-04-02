"""
系统级基础Schema模块

提供统一的BaseSchema基类，用于应用级schema继承。
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Any
from pydantic import BaseModel, ConfigDict, field_serializer
from infra.config.infra_config import infra_settings


class BaseSchema(BaseModel):
    """
    应用级schema基础类

    提供统一的配置和基础功能，并自动处理时区展示转换（北京时间）。
    """
    model_config = ConfigDict(
        from_attributes=True,  # 支持从ORM模型转换
        validate_assignment=True,  # 赋值时验证
        arbitrary_types_allowed=True,  # 允许任意类型
    )

    @field_serializer('*', when_used='always')
    def serialize_datetime(self, value: Any, _info):
        """全局 datetime 转换：数据库 UTC -> 系统配置时区 (Asia/Shanghai)"""
        if value is None:
            return None
        
        # 仅处理 datetime 类型，忽略 Date/Time 或其他类型
        if not isinstance(value, datetime):
            return value
            
        dt = value
        # 1. 确保是感知时区的 (aware)，DB 出来通常是 aware UTC (if USE_TZ=True) 或 naive UTC
        if dt.tzinfo is None:
            aware_dt = dt.replace(tzinfo=ZoneInfo("UTC"))
        else:
            aware_dt = dt
            
        # 2. 转换为系统配置时区 (默认 Asia/Shanghai)
        target_tz = ZoneInfo(infra_settings.TIMEZONE)
        local_dt = aware_dt.astimezone(target_tz)
        
        # 3. 返回易读格式 (YYYY-MM-DD HH:MM:SS)
        return local_dt.strftime("%Y-%m-%d %H:%M:%S")





















