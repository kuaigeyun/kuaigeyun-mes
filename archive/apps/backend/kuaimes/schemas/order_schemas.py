"""
生产订单 Schema 模块

定义生产订单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class OrderBase(BaseModel):
    """生产订单基础 Schema"""
    
    order_no: str = Field(..., max_length=50, description="订单编号")
    order_type: str = Field("计划订单", max_length=50, description="订单类型")
    product_id: int = Field(..., description="产品ID（关联master-data）")
    product_name: str = Field(..., max_length=200, description="产品名称")
    quantity: Decimal = Field(..., description="计划数量")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    source_order_id: Optional[int] = Field(None, description="来源订单ID")
    source_order_no: Optional[str] = Field(None, max_length=50, description="来源订单编号")
    route_id: Optional[int] = Field(None, description="工艺路线ID")
    route_name: Optional[str] = Field(None, max_length=200, description="工艺路线名称")
    priority: str = Field("中", max_length=20, description="优先级")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class OrderCreate(OrderBase):
    """创建生产订单 Schema"""
    pass


class OrderUpdate(BaseModel):
    """更新生产订单 Schema"""
    
    order_type: Optional[str] = Field(None, max_length=50, description="订单类型")
    product_id: Optional[int] = Field(None, description="产品ID")
    product_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    quantity: Optional[Decimal] = Field(None, description="计划数量")
    status: Optional[str] = Field(None, max_length=50, description="订单状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    route_id: Optional[int] = Field(None, description="工艺路线ID")
    route_name: Optional[str] = Field(None, max_length=200, description="工艺路线名称")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class OrderResponse(OrderBase):
    """生产订单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    completed_quantity: Decimal
    status: str
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
