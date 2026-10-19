"""其他收支单据 Schema"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from core.schemas.base import BaseSchema


class MiscCategoryBody(BaseSchema):
    code: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., max_length=200)
    is_active: bool = True
    default_gl_account_code: Optional[str] = Field(None, max_length=20)
    sort_order: int = 0


class MiscCategoryUpdateBody(BaseSchema):
    name: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None
    default_gl_account_code: Optional[str] = Field(None, max_length=20)
    sort_order: Optional[int] = None


class MiscCategoryResponse(BaseSchema):
    id: int
    code: str
    name: str
    is_active: bool
    default_gl_account_code: Optional[str] = None
    sort_order: int = 0


class OtherVoucherLineInput(BaseSchema):
    category_code: str = Field(..., max_length=50)
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    gl_account_code: Optional[str] = Field(None, max_length=20)


class OtherIncomeCreate(BaseSchema):
    income_code: Optional[str] = None
    business_date: date
    counterparty_kind: str = "none"
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    payment_method: str
    bank_account_id: Optional[int] = None
    bank_account: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[Any]] = None
    lines: List[OtherVoucherLineInput]

    @field_validator("lines")
    @classmethod
    def _lines_non_empty(cls, v: List[OtherVoucherLineInput]) -> List[OtherVoucherLineInput]:
        if not v:
            raise ValueError("至少一行明细")
        return v


class OtherIncomeUpdate(BaseSchema):
    business_date: Optional[date] = None
    counterparty_kind: Optional[str] = None
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    payment_method: Optional[str] = None
    bank_account_id: Optional[int] = None
    bank_account: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[Any]] = None
    lines: Optional[List[OtherVoucherLineInput]] = None


class OtherExpenseCreate(BaseSchema):
    expense_code: Optional[str] = None
    business_date: date
    counterparty_kind: str = "none"
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    payment_method: str
    bank_account_id: Optional[int] = None
    bank_account: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[Any]] = None
    lines: List[OtherVoucherLineInput]

    @field_validator("lines")
    @classmethod
    def _lines_non_empty(cls, v: List[OtherVoucherLineInput]) -> List[OtherVoucherLineInput]:
        if not v:
            raise ValueError("至少一行明细")
        return v


class OtherExpenseUpdate(BaseSchema):
    business_date: Optional[date] = None
    counterparty_kind: Optional[str] = None
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    payment_method: Optional[str] = None
    bank_account_id: Optional[int] = None
    bank_account: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[Any]] = None
    lines: Optional[List[OtherVoucherLineInput]] = None


class OtherVoucherLineResponse(BaseSchema):
    id: int
    line_no: int
    category_code: str
    category_name: str
    amount: Decimal
    description: Optional[str] = None
    gl_account_code: Optional[str] = None


class OtherIncomeResponse(BaseSchema):
    id: int
    income_code: str
    business_date: date
    counterparty_kind: str
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    total_amount: Decimal
    payment_method: str
    bank_account_id: Optional[int] = None
    bank_account: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_remarks: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    lines: List[OtherVoucherLineResponse] = Field(default_factory=list)
    capabilities: Optional[Dict[str, Any]] = None
    receivable_id: Optional[int] = None
    receivable_code: Optional[str] = None
    receipt_id: Optional[int] = None
    receipt_code: Optional[str] = None


class OtherExpenseResponse(BaseSchema):
    id: int
    expense_code: str
    business_date: date
    counterparty_kind: str
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    total_amount: Decimal
    payment_method: str
    bank_account_id: Optional[int] = None
    bank_account: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_remarks: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    lines: List[OtherVoucherLineResponse] = Field(default_factory=list)
    capabilities: Optional[Dict[str, Any]] = None
    payable_id: Optional[int] = None
    payable_code: Optional[str] = None
    payment_id: Optional[int] = None
    payment_code: Optional[str] = None


class ReviewActionBody(BaseSchema):
    approved: bool = True
    review_remarks: Optional[str] = None
