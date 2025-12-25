"""
实时监控 Schema 模块

定义实时监控数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class RealTimeMonitoringBase(BaseModel):
    """实时监控基础 Schema"""
    
    monitoring_no: str = Field(..., max_length=50, description="监控编号（组织内唯一）")
    status: str = Field("启用", max_length=50, description="状态")
    
    @validator("monitoring_no")
    def validate_monitoring_no(cls, v):
        """验证监控编号格式"""
        if not v or not v.strip():
            raise ValueError("监控编号不能为空")
        return v.strip()


class RealTimeMonitoringCreate(RealTimeMonitoringBase):
    """创建实时监控 Schema"""
    pass


class RealTimeMonitoringUpdate(BaseModel):
    """更新实时监控 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class RealTimeMonitoringResponse(RealTimeMonitoringBase):
    """实时监控响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

