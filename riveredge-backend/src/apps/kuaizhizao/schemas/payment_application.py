"""
付款申请单 Schema
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict

from core.schemas.base import BaseSchema, UuidStrCoerceMixin


class PaymentApplicationLineBase(BaseModel):
    source_type: str = Field(..., max_length=50, alias="sourceType", description="来源类型")
    source_id: Optional[int] = Field(None, alias="sourceId", description="来源ID")
    source_code: Optional[str] = Field(None, max_length=50, alias="sourceCode", description="来源编码")
    payable_id: Optional[int] = Field(None, alias="payableId", description="应付单ID")
    payable_code: Optional[str] = Field(None, max_length=50, alias="payableCode", description="应付编码")
    line_kind: str = Field("goods", max_length=20, alias="lineKind", description="prepayment/goods/invoice")
    request_amount: Decimal = Field(..., gt=0, alias="requestAmount", description="申请金额")
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class PaymentApplicationLineCreate(PaymentApplicationLineBase):
    pass


class PaymentApplicationLineResponse(PaymentApplicationLineBase):
    id: int
    line_no: int
    paid_amount: Decimal = Decimal("0")
    max_request_amount: Decimal = Decimal("0")

    model_config = ConfigDict(from_attributes=True)


class PaymentApplicationCreate(BaseModel):
    application_code: Optional[str] = Field(None, max_length=50, alias="applicationCode")
    supplier_id: int = Field(..., alias="supplierId")
    supplier_name: str = Field(..., max_length=200, alias="supplierName")
    application_kind: str = Field("goods", max_length=20, alias="applicationKind")
    application_date: Optional[date] = Field(None, alias="applicationDate")
    expected_payment_date: Optional[date] = Field(None, alias="expectedPaymentDate")
    applicant_id: Optional[int] = Field(None, alias="applicantId")
    applicant_name: Optional[str] = Field(None, alias="applicantName")
    supplier_account_name: Optional[str] = Field(None, alias="supplierAccountName")
    supplier_bank_name: Optional[str] = Field(None, alias="supplierBankName")
    supplier_bank_account: Optional[str] = Field(None, alias="supplierBankAccount")
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    items: List[PaymentApplicationLineCreate] = Field(..., min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class PaymentApplicationUpdate(BaseModel):
    supplier_id: Optional[int] = Field(None, alias="supplierId")
    supplier_name: Optional[str] = Field(None, max_length=200, alias="supplierName")
    application_kind: Optional[str] = Field(None, alias="applicationKind")
    application_date: Optional[date] = Field(None, alias="applicationDate")
    expected_payment_date: Optional[date] = Field(None, alias="expectedPaymentDate")
    supplier_account_name: Optional[str] = Field(None, alias="supplierAccountName")
    supplier_bank_name: Optional[str] = Field(None, alias="supplierBankName")
    supplier_bank_account: Optional[str] = Field(None, alias="supplierBankAccount")
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    items: Optional[List[PaymentApplicationLineCreate]] = None

    model_config = ConfigDict(populate_by_name=True)


class PaymentApplicationResponse(UuidStrCoerceMixin, BaseSchema):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    application_code: str = Field(..., alias="applicationCode")
    supplier_id: int = Field(..., alias="supplierId")
    supplier_name: str = Field(..., alias="supplierName")
    application_kind: str = Field(..., alias="applicationKind")
    application_date: Optional[date] = Field(None, alias="applicationDate")
    expected_payment_date: Optional[date] = Field(None, alias="expectedPaymentDate")
    applicant_id: Optional[int] = Field(None, alias="applicantId")
    applicant_name: Optional[str] = Field(None, alias="applicantName")
    total_request_amount: Decimal = Field(..., alias="totalRequestAmount")
    paid_amount: Decimal = Field(..., alias="paidAmount")
    remaining_amount: Decimal = Field(..., alias="remainingAmount")
    status: str
    review_status: str = Field(..., alias="reviewStatus")
    reviewer_id: Optional[int] = Field(None, alias="reviewerId")
    reviewer_name: Optional[str] = Field(None, alias="reviewerName")
    review_time: Optional[datetime] = Field(None, alias="reviewTime")
    review_remarks: Optional[str] = Field(None, alias="reviewRemarks")
    supplier_account_name: Optional[str] = Field(None, alias="supplierAccountName")
    supplier_bank_name: Optional[str] = Field(None, alias="supplierBankName")
    supplier_bank_account: Optional[str] = Field(None, alias="supplierBankAccount")
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    items: List[PaymentApplicationLineResponse] = []
    capabilities: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class PaymentApplicationListResponse(BaseModel):
    data: List[PaymentApplicationResponse]
    total: int


class ApprovePaymentApplicationRequest(BaseModel):
    approved: bool = True
    review_remarks: Optional[str] = Field(None, alias="reviewRemarks")

    model_config = ConfigDict(populate_by_name=True)


class PushPaymentApplicationToPaymentRequest(BaseModel):
    payment_date: Optional[date] = Field(None, alias="paymentDate")
    payment_method: Optional[str] = Field(None, alias="paymentMethod")
    bank_account_id: Optional[int] = Field(None, alias="bankAccountId")
    line_ids: Optional[List[int]] = Field(None, alias="lineIds")
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class PullPaymentApplicationFromPurchaseOrderRequest(BaseModel):
    purchase_order_id: int = Field(..., alias="purchaseOrderId")
    amount: Decimal = Field(..., gt=0)

    model_config = ConfigDict(populate_by_name=True)


class PullPaymentApplicationFromPurchaseReceiptRequest(BaseModel):
    purchase_receipt_id: int = Field(..., alias="purchaseReceiptId")
    amount: Optional[Decimal] = Field(None, gt=0)

    model_config = ConfigDict(populate_by_name=True)


class PullPaymentApplicationFromReconciliationRequest(BaseModel):
    supplier_id: int = Field(..., alias="supplierId")
    items: List[Dict[str, Any]] = Field(..., min_length=1, description="doc_type/doc_id/amount")

    model_config = ConfigDict(populate_by_name=True)
