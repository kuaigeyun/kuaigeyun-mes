"""
财务协同模块数据验证schema

提供财务协同相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
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
    refunded_amount: Decimal = Field(Decimal("0"), ge=0, description="已确认退款冲回合计")
    refund_execution_status: str = Field("未退款", max_length=20, description="退款执行状态")
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
    invoiced_amount: Decimal = Field(Decimal("0"), ge=0, description="已收票金额（列表聚合）")
    remaining_invoice_amount: Decimal = Field(Decimal("0"), ge=0, description="未收票金额（列表聚合）")
    invoice_status: str = Field("未收票", max_length=20, description="收票状态（列表聚合）")
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
    tax_period: Optional[str] = Field(None, max_length=7, description="税务属期")
    verification_status: Optional[str] = Field(None, max_length=32, description="认证状态")
    verification_date: Optional[date] = Field(None, description="认证日期")
    transfer_out_reason: Optional[str] = Field(None, description="转出原因")
    original_invoice_id: Optional[int] = Field(None, description="原蓝字发票ID")
    red_flush_invoice_id: Optional[int] = Field(None, description="红字发票ID")


class ConcurrentSettlementCreate(BaseSchema):
    """开票同时收款/付款（仅拉单自应收/应付时生效）"""

    enabled: bool = Field(False, description="是否同时生成收/付款单")
    total_amount: Optional[Decimal] = Field(None, gt=0, description="收/付款金额（可与开票价税合计不同）")
    payment_method: Optional[str] = Field(None, max_length=50, description="收/付款方式")
    bank_account_id: Optional[int] = Field(None, description="入账/出款账户ID")
    bank_account: Optional[str] = Field(None, max_length=100, description="账户备注")
    voucher_date: Optional[date] = Field(None, description="收/付款日期")
    notes: Optional[str] = Field(None, description="收/付款备注")


class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    """采购发票创建schema"""

    tax_amount: Optional[Decimal] = Field(
        None, ge=0, description="税额（服务端按未税金额×税率计算，入参可忽略）"
    )
    total_amount: Optional[Decimal] = Field(
        None, ge=0, description="价税合计（含税录入时须传入，服务端据此反算未税/税额）"
    )
    source_type: Optional[str] = Field(None, description="加载源单类型 purchase_order|purchase_receipt|payable")
    source_id: Optional[int] = Field(None, description="加载源单ID")
    concurrent_settlement: Optional[ConcurrentSettlementCreate] = Field(
        None, description="从应付开票时可选：同时生成付款单"
    )


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
    refunded_amount: Decimal = Field(Decimal("0"), ge=0, description="已确认退款冲回合计")
    refund_execution_status: str = Field("未退款", max_length=20, description="退款执行状态")
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
    invoiced_amount: Decimal = Field(Decimal("0"), ge=0, description="已开票金额（列表聚合）")
    remaining_invoice_amount: Decimal = Field(Decimal("0"), ge=0, description="未开票金额（列表聚合）")
    invoice_status: str = Field("未开票", max_length=20, description="开票状态（列表聚合）")
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

class FinanceVoucherLinkRef(BaseSchema):
    """关联收/付款凭证简要引用"""
    id: int
    code: str


class PartnerStatementBriefRef(BaseSchema):
    """往来对账单简要引用"""
    id: int
    statement_code: str
    statement_period: str
    status: str


class PaymentVoucherBase(BaseSchema):
    """付款单基础schema"""
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    total_amount: Decimal = Field(..., gt=0, description="付款总额")
    payment_date: date = Field(..., description="付款日期")
    payment_method: str = Field(..., max_length=50, description="付款方式")
    bank_account: Optional[str] = Field(None, max_length=100, description="出款账号")
    bank_account_id: Optional[int] = Field(None, description="银行账户ID")
    settlement_type: str = Field("normal", max_length=20, description="结算类型 normal/prepayment/refund")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PaymentVoucherCreate(PaymentVoucherBase):
    """付款单创建schema"""

    source_type: Optional[str] = Field(None, description="加载源单类型 payable|payment")
    source_id: Optional[int] = Field(None, description="加载源单ID（单源兼容）")
    source_ids: Optional[List[int]] = Field(None, description="加载源付款单ID列表（多源一起退款）")


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
    refunded_amount: Decimal = Decimal("0")
    refund_execution_status: str = "未退款"
    status: str = "Draft"
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    source_voucher_id: Optional[int] = Field(None, description="退款源付款单ID（首张）")
    source_voucher_code: Optional[str] = Field(None, description="退款源付款单号（多源时拼接）")
    source_vouchers: Optional[List["FinanceVoucherLinkRef"]] = Field(
        None, description="退款关联的全部源付款单"
    )
    linked_refund_vouchers: Optional[List["FinanceVoucherLinkRef"]] = None
    linked_partner_statements: Optional[List["PartnerStatementBriefRef"]] = None
    capabilities: Optional[Dict[str, Any]] = None

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
    settlement_type: str = Field("normal", max_length=20, description="结算类型 normal/prepayment/refund")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ReceiptVoucherCreate(ReceiptVoucherBase):
    """收款单创建schema"""

    source_type: Optional[str] = Field(None, description="加载源单类型 receivable|receipt")
    source_id: Optional[int] = Field(None, description="加载源单ID（单源兼容）")
    source_ids: Optional[List[int]] = Field(None, description="加载源收款单ID列表（多源一起退款）")


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
    refunded_amount: Decimal = Decimal("0")
    refund_execution_status: str = "未退款"
    status: str = "Draft"
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    source_voucher_id: Optional[int] = Field(None, description="退款源收款单ID（首张）")
    source_voucher_code: Optional[str] = Field(None, description="退款源收款单号（多源时拼接）")
    source_vouchers: Optional[List[FinanceVoucherLinkRef]] = Field(
        None, description="退款关联的全部源收款单"
    )
    linked_refund_vouchers: Optional[List[FinanceVoucherLinkRef]] = None
    linked_partner_statements: Optional[List[PartnerStatementBriefRef]] = None
    capabilities: Optional[Dict[str, Any]] = None

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
    partner_tax_no: Optional[str] = Field(None, max_length=50, description="购方税号")
    partner_bank_info: Optional[str] = Field(None, max_length=200, description="购方开户行及账号")
    partner_address_phone: Optional[str] = Field(None, max_length=200, description="购方地址及电话")


class SalesInvoiceCreate(SalesInvoiceBase):
    """销售发票创建schema"""

    invoice_amount: Decimal = Field(..., ge=0, description="不含税金额")
    tax_amount: Optional[Decimal] = Field(
        None, ge=0, description="税额（服务端按未税金额×税率计算，入参可忽略）"
    )
    total_amount: Optional[Decimal] = Field(
        None, ge=0, description="价税合计（含税录入时须传入，服务端据此反算未税/税额）"
    )
    source_type: Optional[str] = Field(None, description="加载源单类型 sales_order|sales_delivery|receivable")
    source_id: Optional[int] = Field(None, description="加载源单ID")
    concurrent_settlement: Optional[ConcurrentSettlementCreate] = Field(
        None, description="从应收开票时可选：同时生成收款单"
    )


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
    partner_tax_no: Optional[str] = Field(None, max_length=50)
    partner_bank_info: Optional[str] = Field(None, max_length=200)
    partner_address_phone: Optional[str] = Field(None, max_length=200)


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
    tax_period: Optional[str] = None
    invoice_color: Optional[str] = None
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
    doc_id: Optional[int] = None
    doc_amount: Optional[float] = Field(None, description="单据金额")
    prior_stated_amount: Optional[float] = Field(None, description="已对金额（其它对账单累计）")
    remaining_amount: Optional[float] = Field(None, description="未对金额")
    statement_amount: Optional[float] = Field(None, description="本次对账金额")
    tree_level: Optional[int] = Field(
        0, description="层级：0=应收/应付等主单据，1=其下核销的收/付款单"
    )
    parent_doc_id: Optional[int] = Field(None, description="父级应收/应付单 ID")
    parent_doc_code: Optional[str] = Field(None, description="父级应收/应付单号")
    inbound_detail_doc_type: Optional[str] = Field(
        None, description="可展开入库明细类型：purchase_receipt / outsource_material_receipt"
    )
    inbound_detail_doc_id: Optional[int] = Field(None, description="可展开入库明细单据 ID")


class PartnerStatementLineAmountInput(BaseSchema):
    doc_type: str
    doc_id: int
    statement_amount: float = Field(..., gt=0, description="本次对账金额")


class PartnerStatementUpdateLinesRequest(BaseSchema):
    lines: List[PartnerStatementLineAmountInput] = Field(..., min_length=1)


class PartnerStatementLineDetailItemResponse(BaseSchema):
    material_code: str
    material_name: str
    material_spec: Optional[str] = None
    unit: str
    quantity: float
    unit_price: float
    amount: float
    inspection_quantity: Optional[float] = Field(None, description="质检数量")
    qualified_quantity: Optional[float] = None
    unqualified_quantity: Optional[float] = None
    quality_status: Optional[str] = None
    inspection_date: Optional[str] = Field(None, description="送检/检验日期")
    inspection_passed: Optional[bool] = None
    defect_reason: Optional[str] = None
    process_waste_qty: Optional[float] = Field(None, description="工废数量")
    material_waste_qty: Optional[float] = Field(None, description="料废数量")


class PartnerStatementLineDetailResponse(BaseSchema):
    doc_type: str
    doc_id: int
    doc_code: str
    partner_name: Optional[str] = None
    items: List[PartnerStatementLineDetailItemResponse] = Field(default_factory=list)


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
    excluded_from_period: int = Field(
        0, description="本期因已纳入其它对账单而排除的明细行数"
    )
    existing_period_statement_id: Optional[int] = Field(
        None, description="同一往来同一 YYYY-MM 已存在的未删除对账单"
    )
    existing_period_statement_code: Optional[str] = None
    existing_period: Optional[str] = None


class PartnerStatementCreate(BaseSchema):
    partner_id: int
    partner_type: str = Field(..., description="Customer 或 Supplier")
    statement_period: str = Field(..., description="YYYY-MM")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    line_amounts: Optional[List[PartnerStatementLineAmountInput]] = Field(
        None, description="勾选纳入的单据及本次对账金额；有值时仅生成列表中的单据"
    )


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


# === 合并收款 / 合并付款 / 合并开票 ===


class MergeFinanceAllocationLine(BaseSchema):
    """合并分摊行：源单 + 本次金额"""

    source_id: int = Field(..., description="源单ID（应收或应付）")
    amount: Decimal = Field(..., gt=0, description="本次分摊金额（收款/付款为余额口径；开票为价税合计）")


class MergeReceiptCreate(BaseSchema):
    """多应收合并创建一张收款单"""

    allocations: List[MergeFinanceAllocationLine] = Field(..., min_length=1)
    receipt_date: date = Field(..., description="收款日期")
    payment_method: str = Field(..., max_length=50, description="收款方式")
    bank_account: Optional[str] = Field(None, max_length=100, description="收款账号")
    bank_account_id: Optional[int] = Field(None, description="银行账户ID")
    settlement_type: str = Field("normal", max_length=20, description="结算类型 normal/prepayment/refund")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class MergePaymentCreate(BaseSchema):
    """多应付合并创建一张付款单"""

    allocations: List[MergeFinanceAllocationLine] = Field(..., min_length=1)
    payment_date: date = Field(..., description="付款日期")
    payment_method: str = Field(..., max_length=50, description="付款方式")
    bank_account: Optional[str] = Field(None, max_length=100, description="付款账号")
    bank_account_id: Optional[int] = Field(None, description="银行账户ID")
    settlement_type: str = Field("normal", max_length=20, description="结算类型 normal/prepayment/refund")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class MergeSalesInvoiceCreate(BaseSchema):
    """多应收合并创建一张销售发票"""

    allocations: List[MergeFinanceAllocationLine] = Field(..., min_length=1)
    invoice_date: date = Field(..., description="开票日期")
    invoice_number: str = Field(default="", max_length=50, description="发票号码")
    invoice_type: str = Field("增值税专用发票", max_length=50, description="发票类型")
    tax_rate: Decimal = Field(Decimal("13"), ge=0, le=100, description="税率(%)")
    notes: Optional[str] = Field(None, description="备注")


class MergePurchaseInvoiceCreate(BaseSchema):
    """多应付合并创建一张采购发票"""

    allocations: List[MergeFinanceAllocationLine] = Field(..., min_length=1)
    invoice_date: date = Field(..., description="发票日期")
    invoice_number: str = Field(..., max_length=100, description="发票号码")
    invoice_type: str = Field("增值税专用发票", max_length=20, description="发票类型")
    tax_rate: Decimal = Field(Decimal("13"), ge=0, le=100, description="税率(%)")
    notes: Optional[str] = Field(None, description="备注")


class MergeFinanceVoucherResponse(BaseSchema):
    """合并创建凭证响应"""

    voucher_type: str
    voucher_id: int
    voucher_code: str
    total_amount: float
    partner_id: int
    partner_name: str
    allocations: List[dict]


# === 往来核销记录 ===

class SettlementRecordResponse(BaseSchema):
    """核销记录响应"""

    id: int
    tenant_id: int
    settlement_code: str
    partner_id: int
    partner_name: str
    debit_doc_type: str
    debit_doc_id: int
    debit_doc_code: str
    credit_doc_type: str
    credit_doc_id: int
    credit_doc_code: str
    amount: Decimal
    currency: str
    settlement_date: date
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SettlementRecordListResponse(BaseSchema):
    """核销记录列表"""

    items: List[SettlementRecordResponse]
    total: int
    skip: int
    limit: int
