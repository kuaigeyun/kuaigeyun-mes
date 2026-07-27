"""
财务协同模块数据验证schema

提供财务协同相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime, date
from decimal import Decimal
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
    total_amount: Decimal = Field(..., gt=0, description="应付总金额")
    paid_amount: Decimal = Field(Decimal("0"), ge=0, description="已付金额")
    remaining_amount: Decimal = Field(..., ge=0, description="剩余金额")
    due_date: date = Field(..., description="到期日期")
    payment_terms: Optional[str] = Field(None, max_length=100, description="付款条件")
    status: str = Field("未付款", max_length=20, description="付款状态")
    business_date: date = Field(..., description="业务日期")
    invoice_received: bool = Field(False, description="是否收到发票")
    invoice_number: Optional[str] = Field(None, max_length=100, description="发票号")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("草稿", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PayableCreate(PayableBase):
    """应付单创建schema"""
    payable_code: Optional[str] = Field(None, max_length=50, description="应付单编码（可选，如果不提供则自动生成）")
    pull_source_type: Optional[str] = Field(
        None,
        description="加载源单类型 purchase_order|purchase_receipt（与 source_type 手工创建区分）",
    )
    pull_source_id: Optional[int] = Field(None, description="加载源单ID")


class PayableUpdate(PayableBase):
    """应付单更新schema"""
    payable_code: Optional[str] = Field(None, max_length=50, description="应付单编码")


class PayableResponse(PayableBase):
    """应付单响应schema"""
    id: int = Field(..., description="应付单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    capabilities: Optional[dict] = Field(None, description="下推能力（如 push_payment）")

    class Config:
        from_attributes = True


class PayableListResponse(BaseSchema):
    """应付单列表响应schema"""
    items: List[PayableResponse] = Field(..., description="应付单列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


# === 采购发票 ===

class PurchaseInvoiceBase(BaseSchema):
    """采购发票基础schema"""
    invoice_code: Optional[str] = Field(None, max_length=50, description="发票编码")
    purchase_order_id: Optional[int] = Field(None, description="采购订单ID")
    purchase_order_code: Optional[str] = Field(None, max_length=50, description="采购订单编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    invoice_number: str = Field(..., max_length=100, description="发票号码")
    invoice_date: date = Field(..., description="发票日期")
    invoice_type: str = Field(..., max_length=20, description="发票类型")
    tax_rate: Decimal = Field(..., ge=0, le=100, description="税率（百分比，如 13 表示 13%）")
    invoice_amount: Decimal = Field(..., ge=0, description="未税金额")
    tax_amount: Decimal = Field(..., ge=0, description="税额（服务端按未税金额×税率计算，入参可忽略）")
    total_amount: Decimal = Field(..., ge=0, description="价税合计（服务端计算，入参可忽略）")
    status: str = Field("未审核", max_length=20, description="发票状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("草稿", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    payable_id: Optional[int] = Field(None, description="应付单ID")
    payable_code: Optional[str] = Field(None, max_length=50, description="应付单编码")
    attachment_path: Optional[str] = Field(None, max_length=500, description="附件路径")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    """采购发票创建schema"""

    source_type: Optional[str] = Field(None, description="加载源单类型 purchase_order|purchase_receipt")
    source_id: Optional[int] = Field(None, description="加载源单ID")


class PurchaseInvoiceUpdate(PurchaseInvoiceBase):
    """采购发票更新schema"""
    invoice_code: Optional[str] = Field(None, max_length=50, description="发票编码")


class PurchaseInvoiceResponse(PurchaseInvoiceBase):
    """采购发票响应schema"""
    id: int = Field(..., description="发票ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")

    class Config:
        from_attributes = True


class PurchaseInvoiceListResponse(BaseSchema):
    """采购发票列表响应schema"""
    items: List[PurchaseInvoiceResponse] = Field(..., description="发票列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


# === 应收单 ===

class ReceivableBase(BaseSchema):
    """应收单基础schema"""
    receivable_code: str = Field(..., max_length=50, description="应收单编码")
    source_type: str = Field(..., max_length=20, description="来源单据类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., max_length=50, description="来源单据编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    total_amount: Decimal = Field(..., gt=0, description="应收总金额")
    received_amount: Decimal = Field(Decimal("0"), ge=0, description="已收金额")
    remaining_amount: Decimal = Field(..., ge=0, description="剩余金额")
    due_date: date = Field(..., description="到期日期")
    payment_terms: Optional[str] = Field(None, max_length=100, description="收款条件")
    status: str = Field("未收款", max_length=20, description="收款状态")
    business_date: date = Field(..., description="业务日期")
    invoice_issued: bool = Field(False, description="是否开具发票")
    invoice_number: Optional[str] = Field(None, max_length=100, description="发票号")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("草稿", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ReceivableCreate(ReceivableBase):
    """应收单创建schema"""
    receivable_code: Optional[str] = Field(None, max_length=50, description="应收单编码（可选，如果不提供则自动生成）")
    pull_source_type: Optional[str] = Field(
        None,
        description="加载源单类型 sales_order|sales_delivery（与 source_type 手工创建区分）",
    )
    pull_source_id: Optional[int] = Field(None, description="加载源单ID")


class ReceivableUpdate(ReceivableBase):
    """应收单更新schema"""
    receivable_code: Optional[str] = Field(None, max_length=50, description="应收单编码")


class ReceivableResponse(ReceivableBase):
    """应收单响应schema"""
    id: int = Field(..., description="应收单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    capabilities: Optional[dict] = Field(None, description="下推能力（如 push_receipt）")

    class Config:
        from_attributes = True


class ReceivableListResponse(BaseSchema):
    """应收单列表响应schema"""
    items: List[ReceivableResponse] = Field(..., description="应收单列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


# === 付款记录和收款记录 ===

class PaymentRecordBase(BaseSchema):
    """付款记录基础schema"""
    payable_id: int = Field(..., description="应付单ID")
    payment_amount: Decimal = Field(..., gt=0, description="付款金额")
    payment_date: date = Field(..., description="付款日期")
    payment_method: str = Field(..., max_length=50, description="付款方式")
    reference_number: Optional[str] = Field(None, max_length=100, description="参考号")
    notes: Optional[str] = Field(None, description="备注")


class PaymentRecordCreate(PaymentRecordBase):
    """付款记录创建schema"""
    pass


class ReceiptRecordBase(BaseSchema):
    """收款记录基础schema"""
    receivable_id: int = Field(..., description="应收单ID")
    receipt_amount: Decimal = Field(..., gt=0, description="收款金额")
    receipt_date: date = Field(..., description="收款日期")
    receipt_method: str = Field(..., max_length=50, description="收款方式")
    reference_number: Optional[str] = Field(None, max_length=100, description="参考号")
    notes: Optional[str] = Field(None, description="备注")


class ReceiptRecordCreate(ReceiptRecordBase):
    """收款记录创建schema"""
    pass


# === 付款单（独立凭证）===

class PaymentVoucherBase(BaseSchema):
    """付款单基础schema"""
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    total_amount: Decimal = Field(..., gt=0, description="付款总额")
    payment_date: date = Field(..., description="付款日期")
    payment_method: str = Field(..., max_length=50, description="付款方式")
    bank_account: Optional[str] = Field(None, max_length=100, description="出款账号")
    bank_account_id: Optional[int] = Field(None, description="银行账户ID")
    settlement_type: str = Field("normal", max_length=20, description="结算类型 normal/prepayment")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PaymentVoucherCreate(PaymentVoucherBase):
    """付款单创建schema"""

    source_type: Optional[str] = Field(None, description="加载源单类型 payable")
    source_id: Optional[int] = Field(None, description="加载源单ID")


class PaymentVoucherUpdate(BaseSchema):
    """付款单更新schema"""
    payment_date: Optional[date] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    bank_account: Optional[str] = Field(None, max_length=100)
    bank_account_id: Optional[int] = None
    settlement_type: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PaymentVoucherResponse(PaymentVoucherBase):
    """付款单响应schema"""
    id: int
    tenant_id: int
    payment_code: str
    settled_amount: Decimal = Decimal("0")
    unsettled_amount: Decimal = Decimal("0")
    status: str = "Draft"
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentVoucherListResponse(BaseSchema):
    """付款单列表响应schema"""
    items: List[PaymentVoucherResponse]
    total: int
    skip: int
    limit: int


# === 收款单（独立凭证）===

class ReceiptVoucherBase(BaseSchema):
    """收款单基础schema"""
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    total_amount: Decimal = Field(..., gt=0, description="收款总额")
    receipt_date: date = Field(..., description="收款日期")
    payment_method: str = Field(..., max_length=50, description="收款方式")
    bank_account: Optional[str] = Field(None, max_length=100, description="收款账号")
    bank_account_id: Optional[int] = Field(None, description="银行账户ID")
    settlement_type: str = Field("normal", max_length=20, description="结算类型 normal/prepayment")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ReceiptVoucherCreate(ReceiptVoucherBase):
    """收款单创建schema"""

    source_type: Optional[str] = Field(None, description="加载源单类型 receivable")
    source_id: Optional[int] = Field(None, description="加载源单ID")


class ReceiptVoucherUpdate(BaseSchema):
    """收款单更新schema"""
    receipt_date: Optional[date] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    bank_account: Optional[str] = Field(None, max_length=100)
    bank_account_id: Optional[int] = None
    settlement_type: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ReceiptVoucherResponse(ReceiptVoucherBase):
    """收款单响应schema"""
    id: int
    tenant_id: int
    receipt_code: str
    settled_amount: Decimal = Decimal("0")
    unsettled_amount: Decimal = Decimal("0")
    status: str = "Draft"
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class ReceiptVoucherListResponse(BaseSchema):
    """收款单列表响应schema"""
    items: List[ReceiptVoucherResponse]
    total: int
    skip: int
    limit: int


# === 销售发票 ===

class SalesInvoiceBase(BaseSchema):
    """销售发票基础schema"""
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    invoice_number: str = Field(default="", max_length=50, description="发票号码（手工录入；草稿可为空，与库字段长度一致）")
    invoice_date: date = Field(..., description="开票日期")
    invoice_type: str = Field("增值税专用发票", max_length=50, description="发票类型")
    tax_rate: Decimal = Field(Decimal("13"), ge=0, le=100, description="税率(%)")
    invoice_amount: Decimal = Field(..., description="不含税金额（红字发票为负）")
    tax_amount: Decimal = Field(..., description="税额（红字发票为负）")
    total_amount: Decimal = Field(..., description="价税合计（红字发票为负）")
    receivable_id: Optional[int] = Field(None, description="关联应收单ID")
    receivable_code: Optional[str] = Field(None, max_length=50, description="关联应收单编码")
    attachment_path: Optional[str] = Field(None, max_length=500, description="附件路径")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    notes: Optional[str] = Field(None, description="备注")


class SalesInvoiceCreate(SalesInvoiceBase):
    """销售发票创建schema"""

    invoice_amount: Decimal = Field(..., ge=0, description="不含税金额")
    tax_amount: Decimal = Field(..., ge=0, description="税额")
    total_amount: Decimal = Field(..., ge=0, description="价税合计")
    source_type: Optional[str] = Field(None, description="加载源单类型 sales_order|sales_delivery")
    source_id: Optional[int] = Field(None, description="加载源单ID")


class SalesInvoiceUpdate(BaseSchema):
    """销售发票更新schema"""
    invoice_number: Optional[str] = Field(None, max_length=100)
    invoice_date: Optional[date] = None
    invoice_type: Optional[str] = Field(None, max_length=50)
    tax_rate: Optional[Decimal] = None
    invoice_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class SalesInvoiceLineResponse(BaseSchema):
    """销售发票明细行"""

    id: int
    item_name: str
    spec_model: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal


class SalesInvoiceVoidRequest(BaseSchema):
    """作废请求（当月未抵扣、开票有误等实务场景由企业自行合规）"""

    reason: str = Field(..., min_length=1, max_length=2000, description="作废原因")


class SalesInvoiceRedLetterRequest(BaseSchema):
    """开具红字发票申请（税务红字信息表等线下流程由企业完成，系统生成负数金额蓝字对应的红票草稿）"""

    reason: str = Field(..., min_length=1, max_length=2000, description="红冲原因")


class SalesInvoiceResponse(SalesInvoiceBase):
    """销售发票响应schema"""
    id: int
    tenant_id: int
    invoice_code: str
    original_invoice_id: Optional[int] = None
    red_flush_invoice_id: Optional[int] = None
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    status: str = "未审核"
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_status: str = "待审核"
    review_remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class SalesInvoiceListResponse(BaseSchema):
    """销售发票列表响应schema"""
    items: List[SalesInvoiceResponse]
    total: int
    skip: int
    limit: int


class SalesInvoiceDetailResponse(SalesInvoiceResponse):
    """销售发票详情（含明细行）"""

    items: List[SalesInvoiceLineResponse] = Field(default_factory=list)


# === 往来对账单 ===

class PartnerStatementLineResponse(BaseSchema):
    date: str
    doc_type: str
    doc_code: str
    summary: Optional[str] = None
    debit: float = 0
    credit: float = 0
    balance: float = 0


class PartnerStatementSummaryResponse(BaseSchema):
    opening_balance: float
    debit_total: float
    credit_total: float
    closing_balance: float


class PartnerStatementPreviewResponse(BaseSchema):
    partner_id: int
    partner_name: str
    partner_type: str
    start_date: str
    end_date: str
    company_name: str
    balance_label: str
    summary: PartnerStatementSummaryResponse
    lines: List[PartnerStatementLineResponse]
    partner_snapshot: dict = Field(default_factory=dict)


class PartnerStatementCreate(BaseSchema):
    partner_id: int
    partner_type: str = Field(..., description="Customer 或 Supplier")
    statement_period: str = Field(..., description="YYYY-MM")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PartnerStatementMarkSentRequest(BaseSchema):
    channel: str = Field(..., description="export/print/wechat_manual/email_manual/other")
    notes: Optional[str] = None


class PartnerStatementDisputeRequest(BaseSchema):
    reason: str = Field(..., min_length=1)


class PartnerStatementResponse(BaseSchema):
    id: int
    statement_code: str
    partner_id: int
    partner_name: str
    partner_type: str
    statement_period: str
    start_date: date
    end_date: date
    opening_balance: Decimal
    debit_total: Decimal
    credit_total: Decimal
    closing_balance: Decimal
    status: str
    company_name: Optional[str] = None
    transaction_details: Optional[dict] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    sent_at: Optional[datetime] = None
    sent_by: Optional[int] = None
    sent_channel: Optional[str] = None
    dispute_reason: Optional[str] = None
    disputed_at: Optional[datetime] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PartnerStatementListResponse(BaseSchema):
    items: List[PartnerStatementResponse]
    total: int
    skip: int
    limit: int
