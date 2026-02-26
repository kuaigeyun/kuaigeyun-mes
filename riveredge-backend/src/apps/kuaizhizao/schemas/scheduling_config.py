"""
排程配置Schema

提供排程配置相关的数据验证Schema。

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class SchedulingConfigBase(BaseModel):
    """排程配置基础Schema"""
    config_code: str = Field(..., max_length=50, description="配置编码")
    config_name: str = Field(..., max_length=200, description="配置名称")
    constraints: Dict[str, Any] = Field(..., description="排程约束（JSON格式，含4M开关及权重）")
    is_default: bool = Field(False, description="是否为默认配置")
    is_active: bool = Field(True, description="是否启用")
    description: Optional[str] = Field(None, description="配置描述")


class SchedulingConfigCreate(SchedulingConfigBase):
    """创建排程配置Schema"""
    pass


class SchedulingConfigUpdate(BaseModel):
    """更新排程配置Schema"""
    config_name: Optional[str] = Field(None, max_length=200, description="配置名称")
    constraints: Optional[Dict[str, Any]] = Field(None, description="排程约束（JSON格式）")
    is_default: Optional[bool] = Field(None, description="是否为默认配置")
    is_active: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="配置描述")


class SchedulingConfigResponse(SchedulingConfigBase):
    """排程配置响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    updated_by: Optional[int]

    class Config:
        from_attributes = True


class SchedulingConfigListResponse(BaseModel):
    """排程配置列表响应Schema"""
    data: list[SchedulingConfigResponse]
    total: int
    success: bool = True
