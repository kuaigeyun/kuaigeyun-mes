"""薪酬 schemas。"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class LivingAdvanceCreate(BaseModel):
    year_month: str = Field(..., min_length=7, max_length=7)
    employee_id: int
    amount: Decimal
    # 选人后从档案带出，允许本单修改；银行/卡号回写档案
    workshop_name: Optional[str] = Field(None, max_length=100)
    base_living: Optional[Decimal] = None
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_account: Optional[str] = Field(None, max_length=50)
    reason: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class LivingAdvanceUpdate(BaseModel):
    amount: Optional[Decimal] = None
    workshop_name: Optional[str] = Field(None, max_length=100)
    base_living: Optional[Decimal] = None
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_account: Optional[str] = Field(None, max_length=50)
    reason: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class RewardRecordCreate(BaseModel):
    year_month: str = Field(..., min_length=7, max_length=7)
    employee_id: int
    amount: Decimal
    reason: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class RewardRecordUpdate(BaseModel):
    amount: Optional[Decimal] = None
    reason: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class PayrollSettlementCreate(BaseModel):
    year_month: str = Field(..., min_length=7, max_length=7)
    workshop_name: str = Field(..., max_length=100)
    ot_multiplier: Decimal = Field(default=Decimal("3"))
    notes: Optional[str] = None


class PayrollSettlementUpdate(BaseModel):
    notes: Optional[str] = None
    ot_multiplier: Optional[Decimal] = None
    line_total_output: Optional[Decimal] = None
    line_total_hours: Optional[Decimal] = None
    line_total_wage: Optional[Decimal] = None
    line_bonus_rate: Optional[Decimal] = None


class PayrollSettlementLineUpdate(BaseModel):
    basic_wage: Optional[Decimal] = None
    post_wage: Optional[Decimal] = None
    time_wage: Optional[Decimal] = None
    piece_wage: Optional[Decimal] = None
    night_subsidy: Optional[Decimal] = None
    heat_subsidy: Optional[Decimal] = None
    post_allowance: Optional[Decimal] = None
    allowance: Optional[Decimal] = None
    living_deduct: Optional[Decimal] = None
    rent_utility_deduct: Optional[Decimal] = None
    insurance_deduct: Optional[Decimal] = None
    leave_deduct: Optional[Decimal] = None
    compensation: Optional[Decimal] = None
    tax_deduct: Optional[Decimal] = None
    card_pay: Optional[Decimal] = None
    notes: Optional[str] = None
