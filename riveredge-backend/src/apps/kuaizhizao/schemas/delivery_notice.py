"""
发货通知单数据验证schema

在销售出库前/后向客户发送发货通知，记录物流信息。

Author: RiverEdge Team
Date: 2026-02-19
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


# === 发货通知单 ===

class DeliveryNoticeBase(BaseSchema):
    """发货通知单基础schema"""
    notice_code: Optional[str] = Field(None, max_length=50, description="通知单编码（可选，不提供则自动生成）")
    sales_delivery_id: Optional[int] = Field(None, description="销售出库单ID")
    sales_delivery_code: Optional[str] = Field(None, max_length=50, description="销售出库单编码")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    customer_contact: Optional[str] = Field(None, max_length=100, description="客户联系人")
    customer_phone: Optional[str] = Field(None, max_length=50, description="客户电话")
    planned_delivery_date: Optional[date] = Field(None, description="预计送达日期")
    carrier: Optional[str] = Field(None, max_length=100, description="承运商/物流方式")
    tracking_number: Optional[str] = Field(None, max_length=100, description="运单号")
    shipping_address: Optional[str] = Field(None, description="收货地址")
    status: str = Field("待发送", max_length=20, description="通知状态")
    notes: Optional[str] = Field(None, description="备注")


class DeliveryNoticeCreate(DeliveryNoticeBase):
    """发货通知单创建schema"""
    items: Optional[List["DeliveryNoticeItemCreate"]] = Field(None, description="通知明细列表")


class DeliveryNoticeUpdate(DeliveryNoticeBase):
    """发货通知单更新schema"""
    notice_code: Optional[str] = Field(None, max_length=50, description="通知单编码")


class DeliveryNoticeResponse(DeliveryNoticeBase):
    """发货通知单响应schema"""
    id: int = Field(..., description="通知单ID")
    tenant_id: int = Field(..., description="租户ID")
    sent_at: Optional[datetime] = Field(None, description="发送时间")
    signed_at: Optional[datetime] = Field(None, description="签收时间")
    total_quantity: float = Field(0, description="总数量")
    total_amount: float = Field(0, description="总金额")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class DeliveryNoticeListResponse(DeliveryNoticeResponse):
    """发货通知单列表响应schema"""
    pass


# === 发货通知单明细 ===

class DeliveryNoticeItemBase(BaseSchema):
    """发货通知单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    notice_quantity: float = Field(..., gt=0, description="通知数量")
    unit_price: float = Field(0, ge=0, description="单价")
    total_amount: Optional[float] = Field(None, ge=0, description="金额")
    delivery_item_id: Optional[int] = Field(None, description="销售出库明细ID")
    notes: Optional[str] = Field(None, description="备注")


class DeliveryNoticeItemCreate(DeliveryNoticeItemBase):
    """发货通知单明细创建schema"""
    pass


class DeliveryNoticeItemUpdate(DeliveryNoticeItemBase):
    """发货通知单明细更新schema"""
    pass


class DeliveryNoticeItemResponse(DeliveryNoticeItemBase):
    """发货通知单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    notice_id: int = Field(..., description="通知单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class DeliveryNoticeWithItemsResponse(DeliveryNoticeResponse):
    """发货通知单详情响应（含明细）"""
    items: List[DeliveryNoticeItemResponse] = Field(default_factory=list, description="通知明细列表")
