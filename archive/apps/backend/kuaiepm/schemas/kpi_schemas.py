"""
KPI Schema 模块

定义KPI数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class KPIBase(BaseModel):
    """KPI基础 Schema"""
    
    kpi_code: str = Field(..., max_length=50, description="KPI编码（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("kpi_code")
    def validate_kpi_code(cls, v):
        """验证KPI编码格式"""
        if not v or not v.strip():
            raise ValueError("KPI编码不能为空")
        return v.strip()


class KPICreate(KPIBase):
    """创建KPI Schema"""
    pass


class KPIUpdate(BaseModel):
    """更新KPI Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class KPIResponse(KPIBase):
    """KPI响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
