"""
采购订单 Schema 模块

定义采购订单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class PurchaseOrderBase(BaseModel):
    """采购订单基础 Schema"""
    
    order_no: str = Field(..., max_length=50, description="订单编号")
    order_date: datetime = Field(..., description="订单日期")
    supplier_id: int = Field(..., description="供应商ID")
    total_amount: Decimal = Field(0, description="订单总金额")
    currency: str = Field("CNY", max_length=10, description="币种")
    delivery_date: Optional[datetime] = Field(None, description="交期要求")
    requirement_id: Optional[int] = Field(None, description="关联需求ID")
    order_items: Optional[List[Dict[str, Any]]] = Field(None, description="订单明细")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class PurchaseOrderCreate(PurchaseOrderBase):
    """创建采购订单 Schema"""
    pass


class PurchaseOrderUpdate(BaseModel):
    """更新采购订单 Schema"""
    
    order_date: Optional[datetime] = Field(None, description="订单日期")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    status: Optional[str] = Field(None, max_length=50, description="订单状态")
    total_amount: Optional[Decimal] = Field(None, description="订单总金额")
    currency: Optional[str] = Field(None, max_length=10, description="币种")
    delivery_date: Optional[datetime] = Field(None, description="交期要求")
    order_items: Optional[List[Dict[str, Any]]] = Field(None, description="订单明细")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class PurchaseOrderResponse(PurchaseOrderBase):
    """采购订单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    approval_instance_id: Optional[int] = None
    approval_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
