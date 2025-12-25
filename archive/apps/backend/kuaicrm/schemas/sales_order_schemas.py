"""
销售订单 Schema 模块

定义销售订单数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SalesOrderBase(BaseModel):
    """销售订单基础 Schema"""
    
    order_no: str = Field(..., max_length=50, description="订单编号")
    order_date: datetime = Field(..., description="订单日期")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    opportunity_id: Optional[int] = Field(None, description="关联商机ID")
    status: str = Field("待审批", max_length=50, description="订单状态")
    total_amount: Decimal = Field(..., description="订单金额")
    delivery_date: Optional[datetime] = Field(None, description="交期要求")
    priority: str = Field("普通", max_length=20, description="优先级")
    
    @validator("order_no")
    def validate_order_no(cls, v):
        """验证订单编号格式"""
        if not v or not v.strip():
            raise ValueError("订单编号不能为空")
        return v.strip().upper()
    
    @validator("total_amount")
    def validate_total_amount(cls, v):
        """验证订单金额"""
        if v <= 0:
            raise ValueError("订单金额必须大于0")
        return v


class SalesOrderCreate(SalesOrderBase):
    """创建销售订单 Schema"""
    pass


class SalesOrderUpdate(BaseModel):
    """更新销售订单 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="订单状态")
    total_amount: Optional[Decimal] = Field(None, description="订单金额")
    delivery_date: Optional[datetime] = Field(None, description="交期要求")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")


class SalesOrderResponse(SalesOrderBase):
    """销售订单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    approval_instance_id: Optional[int] = None
    approval_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
