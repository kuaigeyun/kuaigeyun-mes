"""
收货通知单数据验证schema

采购通知仓库收货，不直接动库存。

Author: RiverEdge Team
Date: 2026-02-22
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


# === 收货通知单 ===

class ReceiptNoticeBase(BaseSchema):
    """收货通知单基础schema"""
    notice_code: Optional[str] = Field(None, max_length=50, description="通知单编码（可选，不提供则自动生成）")
    purchase_order_id: int = Field(..., description="采购订单ID")
    purchase_order_code: str = Field(..., max_length=50, description="采购订单编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    supplier_contact: Optional[str] = Field(None, max_length=100, description="供应商联系人")
    supplier_phone: Optional[str] = Field(None, max_length=50, description="供应商电话")
    warehouse_id: Optional[int] = Field(None, description="入库仓库ID")
    warehouse_name: Optional[str] = Field(None, max_length=100, description="入库仓库名称")
    planned_receipt_date: Optional[date] = Field(None, description="计划收货日期")
    status: str = Field("待收货", max_length=20, description="通知状态")
    notes: Optional[str] = Field(None, description="备注")


class ReceiptNoticeCreate(ReceiptNoticeBase):
    """收货通知单创建schema"""
    items: Optional[List["ReceiptNoticeItemCreate"]] = Field(None, description="通知明细列表")


class ReceiptNoticeUpdate(ReceiptNoticeBase):
    """收货通知单更新schema"""
    notice_code: Optional[str] = Field(None, max_length=50, description="通知单编码")


class ReceiptNoticeResponse(ReceiptNoticeBase):
    """收货通知单响应schema"""
    id: int = Field(..., description="通知单ID")
    tenant_id: int = Field(..., description="租户ID")
    notified_at: Optional[datetime] = Field(None, description="通知仓库时间")
    purchase_receipt_id: Optional[int] = Field(None, description="采购入库单ID")
    purchase_receipt_code: Optional[str] = Field(None, max_length=50, description="采购入库单编码")
    total_quantity: float = Field(0, description="总数量")
    total_amount: float = Field(0, description="总金额")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class ReceiptNoticeListResponse(ReceiptNoticeResponse):
    """收货通知单列表响应schema"""
    pass


# === 收货通知单明细 ===

class ReceiptNoticeItemBase(BaseSchema):
    """收货通知单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    notice_quantity: float = Field(..., gt=0, description="通知数量")
    unit_price: float = Field(0, ge=0, description="单价")
    total_amount: Optional[float] = Field(None, ge=0, description="金额")
    purchase_order_item_id: Optional[int] = Field(None, description="采购订单明细ID")
    notes: Optional[str] = Field(None, description="备注")


class ReceiptNoticeItemCreate(ReceiptNoticeItemBase):
    """收货通知单明细创建schema"""
    pass


class ReceiptNoticeItemUpdate(ReceiptNoticeItemBase):
    """收货通知单明细更新schema"""
    pass


class ReceiptNoticeItemResponse(ReceiptNoticeItemBase):
    """收货通知单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    notice_id: int = Field(..., description="通知单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class ReceiptNoticeWithItemsResponse(ReceiptNoticeResponse):
    """收货通知单详情响应（含明细）"""
    items: List[ReceiptNoticeItemResponse] = Field(default_factory=list, description="通知明细列表")
