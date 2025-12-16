"""
环境监测 Schema 模块

定义环境监测数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class EnvironmentMonitoringBase(BaseModel):
    """环境监测基础 Schema"""
    
    monitoring_no: str = Field(..., max_length=50, description="监测编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("monitoring_no")
    def validate_monitoring_no(cls, v):
        """验证监测编号格式"""
        if not v or not v.strip():
            raise ValueError("监测编号不能为空")
        return v.strip()


class EnvironmentMonitoringCreate(EnvironmentMonitoringBase):
    """创建环境监测 Schema"""
    pass


class EnvironmentMonitoringUpdate(BaseModel):
    """更新环境监测 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class EnvironmentMonitoringResponse(EnvironmentMonitoringBase):
    """环境监测响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
