"""
KPI预警 Schema 模块

定义KPI预警数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class KPIAlertBase(BaseModel):
    """KPI预警基础 Schema"""
    
    alert_no: str = Field(..., max_length=50, description="预警编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("alert_no")
    def validate_alert_no(cls, v):
        """验证预警编号格式"""
        if not v or not v.strip():
            raise ValueError("预警编号不能为空")
        return v.strip()


class KPIAlertCreate(KPIAlertBase):
    """创建KPI预警 Schema"""
    pass


class KPIAlertUpdate(BaseModel):
    """更新KPI预警 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class KPIAlertResponse(KPIAlertBase):
    """KPI预警响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
