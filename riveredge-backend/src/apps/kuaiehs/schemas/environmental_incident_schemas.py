"""
环境事故 Schema 模块

定义环境事故数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class EnvironmentalIncidentBase(BaseModel):
    """环境事故基础 Schema"""
    
    incident_no: str = Field(..., max_length=50, description="事故编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("incident_no")
    def validate_incident_no(cls, v):
        """验证事故编号格式"""
        if not v or not v.strip():
            raise ValueError("事故编号不能为空")
        return v.strip()


class EnvironmentalIncidentCreate(EnvironmentalIncidentBase):
    """创建环境事故 Schema"""
    pass


class EnvironmentalIncidentUpdate(BaseModel):
    """更新环境事故 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class EnvironmentalIncidentResponse(EnvironmentalIncidentBase):
    """环境事故响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
