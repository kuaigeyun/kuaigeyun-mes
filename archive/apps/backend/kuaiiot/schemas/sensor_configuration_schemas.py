"""
传感器配置 Schema 模块

定义传感器配置数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SensorConfigurationBase(BaseModel):
    """传感器配置基础 Schema"""
    
    config_no: str = Field(..., max_length=50, description="配置编号（组织内唯一）")
    status: str = Field("启用", max_length=50, description="状态")
    
    @validator("config_no")
    def validate_config_no(cls, v):
        """验证配置编号格式"""
        if not v or not v.strip():
            raise ValueError("配置编号不能为空")
        return v.strip()


class SensorConfigurationCreate(SensorConfigurationBase):
    """创建传感器配置 Schema"""
    pass


class SensorConfigurationUpdate(BaseModel):
    """更新传感器配置 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class SensorConfigurationResponse(SensorConfigurationBase):
    """传感器配置响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

