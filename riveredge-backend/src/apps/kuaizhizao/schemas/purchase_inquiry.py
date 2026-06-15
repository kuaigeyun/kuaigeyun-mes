"""
采购询价单 Schema

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PurchaseInquiryItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    material_id: int
    material_code: str
    material_name: str
    material_spec: Optional[str] = None
    unit: str = "件"
    quantity: Decimal = Field(..., gt=0)
    required_date: Optional[date] = None
    source_requisition_item_id: Optional[int] = None
    notes: Optional[str] = None


class PurchaseInquiryItemCreate(PurchaseInquiryItemBase):
    pass


class PurchaseInquiryItemResponse(PurchaseInquiryItemBase):
    id: int
    inquiry_id: int
    tenant_id: int
    awarded_supplier_id: Optional[int] = None
    awarded_quote_item_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    purchase_order_item_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class PurchaseInquiryVendorBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_id: int
    supplier_name: str
    notes: Optional[str] = None


class PurchaseInquiryVendorCreate(PurchaseInquiryVendorBase):
    pass


class PurchaseInquiryVendorResponse(PurchaseInquiryVendorBase):
    id: int
    inquiry_id: int
    tenant_id: int
    status: str
    quoted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PurchaseSupplierQuoteItemBase(BaseModel):
    inquiry_item_id: int
    quoted_quantity: Decimal = Field(default=Decimal(0), ge=0)
    unit_price: Decimal = Field(default=Decimal(0), ge=0)
    delivery_date: Optional[date] = None
    lead_time_days: Optional[int] = None
    notes: Optional[str] = None


class PurchaseSupplierQuoteItemResponse(PurchaseSupplierQuoteItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quote_id: int
    tenant_id: int
    is_awarded: bool = False
    created_at: datetime
    updated_at: datetime


class PurchaseSupplierQuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    inquiry_id: int
    supplier_id: int
    supplier_name: str
    quote_code: Optional[str] = None
    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    status: str
    submission_channel: str
    entered_by: Optional[int] = None
    total_amount: Decimal
    notes: Optional[str] = None
    items: List[PurchaseSupplierQuoteItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class UpsertSupplierQuoteRequest(BaseModel):
    supplier_id: int
    supplier_name: Optional[str] = None
    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    items: List[PurchaseSupplierQuoteItemBase] = Field(default_factory=list)


class PurchaseInquiryCreate(BaseModel):
    inquiry_code: Optional[str] = None
    inquiry_name: Optional[str] = None
    inquiry_date: Optional[date] = None
    quote_deadline: Optional[date] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    source_code: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[list] = None
    items: List[PurchaseInquiryItemCreate] = Field(default_factory=list)
    vendors: List[PurchaseInquiryVendorCreate] = Field(default_factory=list)


class PurchaseInquiryUpdate(BaseModel):
    inquiry_name: Optional[str] = None
    inquiry_date: Optional[date] = None
    quote_deadline: Optional[date] = None
    notes: Optional[str] = None
    attachments: Optional[list] = None
    items: Optional[List[PurchaseInquiryItemCreate]] = None
    vendors: Optional[List[PurchaseInquiryVendorCreate]] = None


class PurchaseInquiryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    inquiry_code: str
    inquiry_name: Optional[str] = None
    inquiry_date: Optional[date] = None
    quote_deadline: Optional[date] = None
    status: str
    buyer_id: Optional[int] = None
    buyer_name: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    source_code: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_status: str
    review_remarks: Optional[str] = None
    total_quantity: Decimal
    notes: Optional[str] = None
    attachments: Optional[list] = None
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseInquiryItemResponse] = Field(default_factory=list)
    vendors: List[PurchaseInquiryVendorResponse] = Field(default_factory=list)
    quotes: List[PurchaseSupplierQuoteResponse] = Field(default_factory=list)
    lifecycle: Optional[dict] = None


class CreateFromRequisitionRequest(BaseModel):
    item_ids: List[int] = Field(..., description="采购申请行ID")
    supplier_ids: Optional[List[int]] = Field(None, description="受邀供应商，不传则按物料默认供应商推荐")
    inquiry_name: Optional[str] = None
    quote_deadline: Optional[date] = None
    notes: Optional[str] = None


class AwardQuotesRequest(BaseModel):
    awards: List[Dict[str, int]] = Field(
        ...,
        description="定标列表，每项含 inquiry_item_id 与 quote_item_id",
    )

    @field_validator("awards", mode="before")
    @classmethod
    def _normalize_awards(cls, v):
        if not v:
            return v
        out = []
        for row in v:
            if not isinstance(row, dict):
                continue
            out.append({
                "inquiry_item_id": int(row["inquiry_item_id"]),
                "quote_item_id": int(row["quote_item_id"]),
            })
        return out


class ConvertInquiryToPORequest(BaseModel):
    item_ids: Optional[List[int]] = Field(None, description="询价行ID，不传则转全部已定标行")
    persist_default_supplier_to_material: bool = False


class ApproveInquiryRequest(BaseModel):
    approved: bool = True
    review_remarks: Optional[str] = None


class ComparisonCell(BaseModel):
    quote_item_id: Optional[int] = None
    quote_id: Optional[int] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    unit_price: Optional[Decimal] = None
    quoted_quantity: Optional[Decimal] = None
    delivery_date: Optional[date] = None
    lead_time_days: Optional[int] = None
    is_lowest_price: bool = False
    is_awarded: bool = False


class ComparisonRow(BaseModel):
    inquiry_item_id: int
    material_id: int
    material_code: str
    material_name: str
    quantity: Decimal
    required_date: Optional[date] = None
    cells: List[ComparisonCell] = Field(default_factory=list)


class ComparisonMatrixResponse(BaseModel):
    inquiry_id: int
    suppliers: List[PurchaseInquiryVendorResponse] = Field(default_factory=list)
    rows: List[ComparisonRow] = Field(default_factory=list)
