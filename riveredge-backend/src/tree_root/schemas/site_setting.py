"""
站点设置 Schema 模块

定义站点设置相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SiteSettingUpdate(BaseModel):
    """
    站点设置更新 Schema
    
    用于更新站点设置的请求数据。
    """
    settings: Dict[str, Any] = Field(..., description="设置项（JSON 字典）")


class SiteSettingResponse(BaseModel):
    """
    站点设置响应 Schema
    
    用于返回站点设置信息。
    """
    uuid: str = Field(..., description="设置UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    settings: Dict[str, Any] = Field(..., description="设置项（JSON 字典）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

