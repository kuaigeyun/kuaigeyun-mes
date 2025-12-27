"""
经营仪表盘 Schema 模块

定义经营仪表盘数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BusinessDashboardBase(BaseModel):
    """经营仪表盘基础 Schema"""
    
    dashboard_no: str = Field(..., max_length=50, description="仪表盘编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("dashboard_no")
    def validate_dashboard_no(cls, v):
        """验证仪表盘编号格式"""
        if not v or not v.strip():
            raise ValueError("仪表盘编号不能为空")
        return v.strip()


class BusinessDashboardCreate(BusinessDashboardBase):
    """创建经营仪表盘 Schema"""
    pass


class BusinessDashboardUpdate(BaseModel):
    """更新经营仪表盘 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class BusinessDashboardResponse(BusinessDashboardBase):
    """经营仪表盘响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
