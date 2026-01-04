"""
财务协同模块数据验证schema

提供财务协同相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


# === 应付单 ===

class PayableBase(BaseSchema):
    """应付单基础schema"""
    payable_code: str = Field(..., max_length=50, description="应付单编码")
    source_type: str = Field(..., max_length=20, description="来源单据类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., max_length=50, description="来源单据编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    total_amount: float = Field(..., gt=0, description="应付总金额")
    paid_amount: float = Field(0, ge=0, description="已付金额")
    remaining_amount: float = Field(..., ge=0, description="剩余金额")
    due_date: date = Field(..., description="到期日期")
    payment_terms: Optional[str] = Field(None, max_length=100, description="付款条件")
    status: str = Field("未付款", max_length=20, description="付款状态")
    business_date: date = Field(..., description="业务日期")
    invoice_received: bool = Field(False, description="是否收到发票")
    invoice_number: Optional[str] = Field(None, max_length=100, description="发票号")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class PayableCreate(PayableBase):
    """应付单创建schema"""
    payable_code: Optional[str] = Field(None, max_length=50, description="应付单编码（可选，如果不提供则自动生成）")


class PayableUpdate(PayableBase):
    """应付单更新schema"""
    payable_code: Optional[str] = Field(None, max_length=50, description="应付单编码")


class PayableResponse(PayableBase):
    """应付单响应schema"""
    id: int = Field(..., description="应付单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class PayableListResponse(PayableResponse):
    """应付单列表响应schema（简化版）"""
    pass


# === 采购发票 ===

class PurchaseInvoiceBase(BaseSchema):
    """采购发票基础schema"""
    invoice_code: str = Field(..., max_length=50, description="发票编码")
    purchase_order_id: int = Field(..., description="采购订单ID")
    purchase_order_code: str = Field(..., max_length=50, description="采购订单编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    invoice_number: str = Field(..., max_length=100, description="发票号码")
    invoice_date: date = Field(..., description="发票日期")
    invoice_type: str = Field(..., max_length=20, description="发票类型")
    tax_rate: float = Field(..., ge=0, le=100, description="税率")
    invoice_amount: float = Field(..., ge=0, description="发票金额")
    tax_amount: float = Field(..., ge=0, description="税额")
    total_amount: float = Field(..., ge=0, description="价税合计")
    status: str = Field("未审核", max_length=20, description="发票状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    payable_id: Optional[int] = Field(None, description="应付单ID")
    payable_code: Optional[str] = Field(None, max_length=50, description="应付单编码")
    attachment_path: Optional[str] = Field(None, max_length=500, description="附件路径")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    """采购发票创建schema"""
    pass


class PurchaseInvoiceUpdate(PurchaseInvoiceBase):
    """采购发票更新schema"""
    invoice_code: Optional[str] = Field(None, max_length=50, description="发票编码")


class PurchaseInvoiceResponse(PurchaseInvoiceBase):
    """采购发票响应schema"""
    id: int = Field(..., description="发票ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class PurchaseInvoiceListResponse(PurchaseInvoiceResponse):
    """采购发票列表响应schema（简化版）"""
    pass


# === 应收单 ===

class ReceivableBase(BaseSchema):
    """应收单基础schema"""
    receivable_code: str = Field(..., max_length=50, description="应收单编码")
    source_type: str = Field(..., max_length=20, description="来源单据类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., max_length=50, description="来源单据编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    total_amount: float = Field(..., gt=0, description="应收总金额")
    received_amount: float = Field(0, ge=0, description="已收金额")
    remaining_amount: float = Field(..., ge=0, description="剩余金额")
    due_date: date = Field(..., description="到期日期")
    payment_terms: Optional[str] = Field(None, max_length=100, description="收款条件")
    status: str = Field("未收款", max_length=20, description="收款状态")
    business_date: date = Field(..., description="业务日期")
    invoice_issued: bool = Field(False, description="是否开具发票")
    invoice_number: Optional[str] = Field(None, max_length=100, description="发票号")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class ReceivableCreate(ReceivableBase):
    """应收单创建schema"""
    receivable_code: Optional[str] = Field(None, max_length=50, description="应收单编码（可选，如果不提供则自动生成）")


class ReceivableUpdate(ReceivableBase):
    """应收单更新schema"""
    receivable_code: Optional[str] = Field(None, max_length=50, description="应收单编码")


class ReceivableResponse(ReceivableBase):
    """应收单响应schema"""
    id: int = Field(..., description="应收单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class ReceivableListResponse(ReceivableResponse):
    """应收单列表响应schema（简化版）"""
    pass


# === 付款记录和收款记录（可选扩展）===

class PaymentRecordBase(BaseSchema):
    """付款记录基础schema"""
    payable_id: int = Field(..., description="应付单ID")
    payment_amount: float = Field(..., gt=0, description="付款金额")
    payment_date: date = Field(..., description="付款日期")
    payment_method: str = Field(..., max_length=50, description="付款方式")
    reference_number: Optional[str] = Field(None, max_length=100, description="参考号")
    notes: Optional[str] = Field(None, description="备注")


class PaymentRecordCreate(PaymentRecordBase):
    """付款记录创建schema"""
    pass


class PaymentRecordResponse(PaymentRecordBase):
    """付款记录响应schema"""
    id: int = Field(..., description="付款记录ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


class ReceiptRecordBase(BaseSchema):
    """收款记录基础schema"""
    receivable_id: int = Field(..., description="应收单ID")
    receipt_amount: float = Field(..., gt=0, description="收款金额")
    receipt_date: date = Field(..., description="收款日期")
    receipt_method: str = Field(..., max_length=50, description="收款方式")
    reference_number: Optional[str] = Field(None, max_length=100, description="参考号")
    notes: Optional[str] = Field(None, description="备注")


class ReceiptRecordCreate(ReceiptRecordBase):
    """收款记录创建schema"""
    pass


class ReceiptRecordResponse(ReceiptRecordBase):
    """收款记录响应schema"""
    id: int = Field(..., description="收款记录ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True
