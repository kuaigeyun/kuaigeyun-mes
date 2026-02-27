"""
采购订单数据验证Schema

提供采购订单相关的Pydantic数据验证模型。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import date, datetime
from typing import List, Optional
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, field_validator

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus

# 导入BaseSchema用于兼容性
from core.schemas.base import BaseSchema


# === 采购订单 ===
class PurchaseOrderBase(BaseSchema):
    """采购订单基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    order_code: str = Field(..., max_length=50, description="订单编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    supplier_contact: Optional[str] = Field(None, max_length=100, description="供应商联系人")
    supplier_phone: Optional[str] = Field(None, max_length=20, description="供应商电话")
    order_date: date = Field(..., description="订单日期")
    delivery_date: date = Field(..., description="要求到货日期")
    order_type: str = Field("标准采购", max_length=20, description="订单类型")
    total_quantity: Decimal = Field(default=Decimal(0), ge=0, description="总数量")
    total_amount: Decimal = Field(default=Decimal(0), ge=0, description="订单总金额")
    tax_rate: Decimal = Field(default=Decimal(0), ge=0, le=1, description="税率")
    tax_amount: Decimal = Field(default=Decimal(0), ge=0, description="税额")
    net_amount: Decimal = Field(default=Decimal(0), ge=0, description="净金额")
    currency: str = Field("CNY", max_length=10, description="币种")
    exchange_rate: Decimal = Field(default=Decimal(1), gt=0, description="汇率")
    status: str = Field(default=DocumentStatus.DRAFT.value, max_length=20, description="订单状态")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PurchaseOrderCreate(PurchaseOrderBase):
    """采购订单创建Schema"""
    order_code: Optional[str] = Field(None, max_length=50, description="订单编码")
    items: List["PurchaseOrderItemCreate"] = Field(..., description="订单明细")


class PurchaseOrderUpdate(PurchaseOrderBase):
    """采购订单更新Schema"""
    order_code: Optional[str] = Field(None, max_length=50, description="订单编码")
    items: Optional[List["PurchaseOrderItemUpdate"]] = Field(None, description="订单明细")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PurchaseOrderResponse(PurchaseOrderBase):
    """采购订单响应Schema"""
    id: int = Field(..., description="订单ID")
    tenant_id: int = Field(..., description="租户ID")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field(default=ReviewStatus.PENDING.value, max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    items: List["PurchaseOrderItemResponse"] = Field(default_factory=list, description="订单明细")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")


class PurchaseOrderListResponse(PurchaseOrderResponse):
    """采购订单列表响应Schema"""
    items_count: Optional[int] = Field(None, description="订单明细条数（列表用）")


# === 采购订单明细 ===
class PurchaseOrderItemBase(BaseSchema):
    """采购订单明细基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    ordered_quantity: Decimal = Field(..., gt=0, description="采购数量")
    unit: str = Field(..., max_length=20, description="单位")
    unit_price: Decimal = Field(..., ge=0, description="单价")
    total_price: Decimal = Field(..., ge=0, description="总价")
    received_quantity: Decimal = Field(default=Decimal(0), ge=0, description="已到货数量")
    outstanding_quantity: Decimal = Field(default=Decimal(0), ge=0, description="未到货数量")
    required_date: date = Field(..., description="要求到货日期")
    actual_delivery_date: Optional[date] = Field(None, description="实际到货日期")
    quality_requirements: Optional[str] = Field(None, description="质量要求")
    inspection_required: bool = Field(True, description="是否需要检验")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    """采购订单明细创建Schema"""
    pass


class PurchaseOrderItemUpdate(PurchaseOrderItemBase):
    """采购订单明细更新Schema"""
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    ordered_quantity: Optional[Decimal] = Field(None, gt=0, description="采购数量")


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    """采购订单明细响应Schema"""
    id: int = Field(..., description="明细ID")
    order_id: int = Field(..., description="订单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


# === 审核相关Schema ===
class PurchaseOrderApprove(BaseSchema):
    """采购订单审核Schema"""
    approved: bool = Field(..., description="是否审核通过")
    review_remarks: Optional[str] = Field(None, description="审核备注")


class PurchaseOrderConfirm(BaseSchema):
    """采购订单确认Schema"""
    confirm_remarks: Optional[str] = Field(None, description="确认备注")


# === 查询相关Schema ===
class PurchaseOrderListParams(BaseSchema):
    """采购订单列表查询参数"""
    skip: Optional[int] = Field(0, ge=0, description="跳过数量")
    limit: Optional[int] = Field(20, ge=1, le=100, description="返回数量")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    status: Optional[str] = Field(None, description="订单状态")
    review_status: Optional[str] = Field(None, description="审核状态")
    order_date_from: Optional[date] = Field(None, description="订单日期从")
    order_date_to: Optional[date] = Field(None, description="订单日期到")
    delivery_date_from: Optional[date] = Field(None, description="到货日期从")
    delivery_date_to: Optional[date] = Field(None, description="到货日期到")
    keyword: Optional[str] = Field(None, description="关键词搜索")
