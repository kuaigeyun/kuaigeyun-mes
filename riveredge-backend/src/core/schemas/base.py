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
    应用级 schema 基础类。

    时区展示（北京时间）仅作用于 API JSON 输出，不得参与 ORM 写库：

    - **响应**：FastAPI 序列化走 ``mode='json'``，``field_serializer(when_used='json')`` 生效。
    - **写库**：服务层 ``model_dump(exclude_unset=True)`` 须保持 ``datetime`` 等 Python 原生类型；
      禁止将 ``when_used`` 改为 ``'always'``（会把 datetime 格式化成字符串，Tortoise UPDATE 报
      ``expected datetime, got str``）。
    """
    model_config = ConfigDict(
        from_attributes=True,  # 支持从ORM模型转换
        validate_assignment=True,  # 赋值时验证
        arbitrary_types_allowed=True,  # 允许任意类型
    )

    @field_serializer('*', when_used='json')
    def serialize_datetime(self, value: Any, _info):
        """API JSON 输出：数据库 UTC -> 系统配置时区 (Asia/Shanghai)。不参与 model_dump 写库。"""
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





















