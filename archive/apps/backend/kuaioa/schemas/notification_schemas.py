"""
通知 Schema 模块

定义通知数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class NotificationBase(BaseModel):
    """通知基础 Schema"""
    
    notification_no: str = Field(..., max_length=50, description="通知编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("notification_no")
    def validate_notification_no(cls, v):
        """验证通知编号格式"""
        if not v or not v.strip():
            raise ValueError("通知编号不能为空")
        return v.strip()


class NotificationCreate(NotificationBase):
    """创建通知 Schema"""
    pass


class NotificationUpdate(BaseModel):
    """更新通知 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class NotificationResponse(NotificationBase):
    """通知响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
