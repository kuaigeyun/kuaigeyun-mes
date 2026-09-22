"""请假出差 schemas。"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LeaveRequestCreate(BaseModel):
    leave_type: str = Field(..., max_length=30)
    title: str = Field(..., max_length=200)
    start_at: str
    end_at: str
    days: Optional[Decimal] = None
    leave_hours: Optional[Decimal] = None
    deduct_enabled: bool = False
    deduct_amount: Optional[Decimal] = None
    workshop_name: Optional[str] = Field(None, max_length=100)
    production_line_name: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[int] = None
    destination: Optional[str] = Field(None, max_length=200)
    reason: Optional[str] = None
    department_name: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("leave_hours", "deduct_amount", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        if v is None or v == "":
            return None
        return v


class LeaveRequestUpdate(BaseModel):
    leave_type: Optional[str] = Field(None, max_length=30)
    title: Optional[str] = Field(None, max_length=200)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    days: Optional[Decimal] = None
    leave_hours: Optional[Decimal] = None
    deduct_enabled: Optional[bool] = None
    deduct_amount: Optional[Decimal] = None
    workshop_name: Optional[str] = Field(None, max_length=100)
    production_line_name: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[int] = None
    destination: Optional[str] = Field(None, max_length=200)
    reason: Optional[str] = None
    department_name: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("leave_hours", "deduct_amount", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        if v is None or v == "":
            return None
        return v
