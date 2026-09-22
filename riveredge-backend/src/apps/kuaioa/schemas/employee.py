"""员工档案 schemas。"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class EmployeeProfileCreate(BaseModel):
    full_name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    workshop_name: Optional[str] = Field(None, max_length=100)
    production_line_name: Optional[str] = Field(None, max_length=100)
    employment_type: str = Field(default="formal", max_length=20)
    pay_method: str = Field(default="time", max_length=20)
    hourly_rate: Optional[Decimal] = None
    hire_date: Optional[str] = None
    leave_date: Optional[str] = None
    bank_account: Optional[str] = Field(None, max_length=50)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_branch: Optional[str] = Field(None, max_length=200)
    living_allowance: Optional[Decimal] = None
    post_wage: Optional[Decimal] = None
    social_insurance: Optional[Decimal] = None
    housing_fund: Optional[Decimal] = None
    rent_utility: Optional[Decimal] = None
    welfare_dragon_boat: Optional[Decimal] = None
    welfare_mid_autumn: Optional[Decimal] = None
    welfare_spring_festival: Optional[Decimal] = None
    user_id: Optional[int] = None
    department_name: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class EmployeeProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    workshop_name: Optional[str] = Field(None, max_length=100)
    production_line_name: Optional[str] = Field(None, max_length=100)
    employment_type: Optional[str] = Field(None, max_length=20)
    pay_method: Optional[str] = Field(None, max_length=20)
    hourly_rate: Optional[Decimal] = None
    hire_date: Optional[str] = None
    leave_date: Optional[str] = None
    bank_account: Optional[str] = Field(None, max_length=50)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_branch: Optional[str] = Field(None, max_length=200)
    living_allowance: Optional[Decimal] = None
    post_wage: Optional[Decimal] = None
    social_insurance: Optional[Decimal] = None
    housing_fund: Optional[Decimal] = None
    rent_utility: Optional[Decimal] = None
    welfare_dragon_boat: Optional[Decimal] = None
    welfare_mid_autumn: Optional[Decimal] = None
    welfare_spring_festival: Optional[Decimal] = None
    user_id: Optional[int] = None
    department_name: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
