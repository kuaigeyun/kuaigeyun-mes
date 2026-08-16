"""请假出差 schemas。"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class LeaveRequestCreate(BaseModel):
    leave_type: str = Field(..., max_length=30)
    title: str = Field(..., max_length=200)
    start_at: str
    end_at: str
    days: Optional[Decimal] = None
    destination: Optional[str] = Field(None, max_length=200)
    reason: Optional[str] = None
    department_name: Optional[str] = None
    notes: Optional[str] = None


class LeaveRequestUpdate(BaseModel):
    leave_type: Optional[str] = Field(None, max_length=30)
    title: Optional[str] = Field(None, max_length=200)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    days: Optional[Decimal] = None
    destination: Optional[str] = Field(None, max_length=200)
    reason: Optional[str] = None
    department_name: Optional[str] = None
    notes: Optional[str] = None
