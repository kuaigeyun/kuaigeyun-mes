"""培训 schemas。"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class TrainingPlanCreate(BaseModel):
    plan_name: str = Field(..., max_length=200)
    plan_type: str = Field(default="quality", max_length=50)
    department_name: Optional[str] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    description: Optional[str] = None
    reminder_days: int = 7


class TrainingPlanUpdate(BaseModel):
    plan_name: Optional[str] = Field(None, max_length=200)
    plan_type: Optional[str] = Field(None, max_length=50)
    department_name: Optional[str] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    reminder_days: Optional[int] = None


class TrainingRecordCreate(BaseModel):
    plan_id: Optional[int] = None
    training_name: str = Field(..., max_length=200)
    trainee_id: Optional[int] = None
    trainee_name: Optional[str] = None
    trainer_name: Optional[str] = None
    training_date: Optional[str] = None
    theory_score: Optional[Decimal] = None
    practice_score: Optional[Decimal] = None
    is_passed: bool = False
    notes: Optional[str] = None


class TrainingRecordUpdate(BaseModel):
    training_name: Optional[str] = Field(None, max_length=200)
    trainee_id: Optional[int] = None
    trainee_name: Optional[str] = None
    trainer_name: Optional[str] = None
    training_date: Optional[str] = None
    theory_score: Optional[Decimal] = None
    practice_score: Optional[Decimal] = None
    is_passed: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class WorkLicenseCreate(BaseModel):
    license_name: str = Field(..., max_length=200)
    license_type: str = Field(default="work", max_length=50)
    holder_id: Optional[int] = None
    holder_name: Optional[str] = None
    department_name: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    reminder_days: int = 30
    notes: Optional[str] = None


class WorkLicenseUpdate(BaseModel):
    license_name: Optional[str] = Field(None, max_length=200)
    license_type: Optional[str] = Field(None, max_length=50)
    holder_id: Optional[int] = None
    holder_name: Optional[str] = None
    department_name: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    status: Optional[str] = None
    reminder_days: Optional[int] = None
    notes: Optional[str] = None
