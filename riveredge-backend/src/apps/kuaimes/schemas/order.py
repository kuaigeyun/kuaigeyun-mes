"""
生产订单数据模式

定义生产订单的 Pydantic 模式。
"""

from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class OrderCreate(BaseModel):
    """生产订单创建模式"""
    order_no: str = Field(..., description="订单编号")
    product_name: str = Field(..., description="产品名称")
    quantity: int = Field(..., gt=0, description="数量")
    status: Optional[str] = Field(default="pending", description="订单状态")


class OrderUpdate(BaseModel):
    """生产订单更新模式"""
    product_name: Optional[str] = Field(None, description="产品名称")
    quantity: Optional[int] = Field(None, gt=0, description="数量")
    status: Optional[str] = Field(None, description="订单状态")


class OrderResponse(BaseModel):
    """生产订单响应模式"""
    uuid: str
    tenant_id: int
    order_no: str
    product_name: str
    quantity: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

