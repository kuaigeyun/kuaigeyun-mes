"""月结定价 Schema"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class PriceSettlementCandidateResponse(BaseSchema):
    side: str
    source_order_id: int
    source_order_code: str
    source_line_id: int
    partner_id: int
    partner_name: str
    material_id: int
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None
    material_model: Optional[str] = None
    material_unit: Optional[str] = None
    order_quantity: Decimal
    settled_quantity: Decimal
    before_unit_price: Decimal
    provisional_unit_price: Optional[Decimal] = None
    suggested_unit_price: Optional[Decimal] = None
    after_unit_price: Optional[Decimal] = None
    order_date: Optional[date] = None


class PriceSettlementLineInput(BaseSchema):
    source_line_id: int
    after_unit_price: Decimal = Field(..., ge=0)


class PriceSettlementBatchCreate(BaseSchema):
    period: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    side: str = Field(..., pattern=r"^(sales|purchase)$")
    partner_id: int
    price_source: str = Field(default="partner_book")
    notes: Optional[str] = None
    lines: List[PriceSettlementLineInput] = Field(default_factory=list)


class PriceSettlementLineResponse(BaseSchema):
    id: int
    source_order_id: int
    source_order_code: str
    source_line_id: int
    material_id: int
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    settled_quantity: Decimal
    before_unit_price: Decimal
    after_unit_price: Decimal
    delta_amount: Decimal
    finance_adjustment_id: Optional[int] = None
    finance_adjustment_type: Optional[str] = None


class PriceSettlementBatchResponse(BaseSchema):
    id: int
    batch_code: str
    period: str
    side: str
    partner_id: int
    partner_name: str
    status: str
    price_source: str
    total_delta_amount: Decimal
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    applied_by_name: Optional[str] = None
    lines: List[PriceSettlementLineResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PriceSettlementApplyResultResponse(BaseSchema):
    batch: PriceSettlementBatchResponse
    receivable_ids: List[int] = Field(default_factory=list)
    payable_ids: List[int] = Field(default_factory=list)


class ProvisionalSummaryResponse(BaseSchema):
    side: str
    partner_id: int
    partner_name: str
    provisional_line_count: int
    period: str
