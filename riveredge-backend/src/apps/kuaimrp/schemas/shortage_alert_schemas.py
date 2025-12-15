"""
缺料预警 Schema 模块

定义缺料预警相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ShortageAlertBase(BaseModel):
    """缺料预警基础 Schema"""
    
    alert_no: str = Field(..., max_length=50, description="预警编号")
    material_id: int = Field(..., description="物料ID")
    requirement_id: Optional[int] = Field(None, description="关联需求ID")
    shortage_qty: Decimal = Field(..., description="缺料数量")
    shortage_date: datetime = Field(..., description="缺料日期")
    alert_level: str = Field("一般", max_length=20, description="预警等级")
    alert_reason: Optional[str] = Field(None, description="缺料原因")
    suggested_action: Optional[str] = Field(None, description="处理建议")


class ShortageAlertCreate(ShortageAlertBase):
    """创建缺料预警 Schema"""
    pass


class ShortageAlertUpdate(BaseModel):
    """更新缺料预警 Schema"""
    
    shortage_qty: Optional[Decimal] = Field(None, description="缺料数量")
    shortage_date: Optional[datetime] = Field(None, description="缺料日期")
    alert_level: Optional[str] = Field(None, max_length=20, description="预警等级")
    alert_reason: Optional[str] = Field(None, description="缺料原因")
    alert_status: Optional[str] = Field(None, max_length=50, description="预警状态")
    suggested_action: Optional[str] = Field(None, description="处理建议")
    handler_id: Optional[int] = Field(None, description="处理人ID")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    handle_result: Optional[str] = Field(None, description="处理结果")


class ShortageAlertResponse(ShortageAlertBase):
    """缺料预警响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    alert_status: str
    handler_id: Optional[int] = None
    handled_at: Optional[datetime] = None
    handle_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
