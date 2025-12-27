"""
数据预警 Schema 模块

定义数据预警数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class DataAlertBase(BaseModel):
    """数据预警基础 Schema"""
    
    alert_no: str = Field(..., max_length=50, description="预警编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("alert_no")
    def validate_alert_no(cls, v):
        """验证预警编号格式"""
        if not v or not v.strip():
            raise ValueError("预警编号不能为空")
        return v.strip()


class DataAlertCreate(DataAlertBase):
    """创建数据预警 Schema"""
    pass


class DataAlertUpdate(BaseModel):
    """更新数据预警 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class DataAlertResponse(DataAlertBase):
    """数据预警响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

