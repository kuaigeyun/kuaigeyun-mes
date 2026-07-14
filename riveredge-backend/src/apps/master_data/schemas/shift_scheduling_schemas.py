"""排班管理 Schema"""

from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class ShiftBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    start_time: time = Field(..., alias="startTime")
    end_time: time = Field(..., alias="endTime")
    crosses_midnight: bool = Field(False, alias="crossesMidnight")
    standard_hours: Decimal = Field(Decimal("8"), alias="standardHours")
    is_active: bool = Field(True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("code", "name")
    @classmethod
    def strip_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("不能为空")
        return v


class ShiftCreate(ShiftBase):
    pass


class ShiftUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=200)
    start_time: Optional[time] = Field(None, alias="startTime")
    end_time: Optional[time] = Field(None, alias="endTime")
    crosses_midnight: Optional[bool] = Field(None, alias="crossesMidnight")
    standard_hours: Optional[Decimal] = Field(None, alias="standardHours")
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class ShiftResponse(ShiftBase):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ShiftRosterCreate(BaseModel):
    scope_type: Literal["work_group", "employee"] = Field("work_group", alias="scopeType")
    work_group_id: Optional[int] = Field(None, alias="workGroupId")
    employee_id: Optional[int] = Field(None, alias="employeeId")
    period_start: date = Field(..., alias="periodStart")
    remarks: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_scope(self) -> "ShiftRosterCreate":
        if self.scope_type == "work_group":
            if not self.work_group_id:
                raise ValueError("工作小组排班须指定 workGroupId")
            if self.employee_id:
                raise ValueError("工作小组排班不可指定 employeeId")
        elif self.scope_type == "employee":
            if not self.employee_id:
                raise ValueError("员工排班须指定 employeeId")
            if self.work_group_id:
                raise ValueError("员工排班不可指定 workGroupId")
        return self


class ShiftAssignmentItem(BaseModel):
    employee_id: int = Field(..., alias="employeeId")
    work_date: date = Field(..., alias="workDate")
    shift_id: Optional[int] = Field(None, alias="shiftId")

    model_config = ConfigDict(populate_by_name=True)


class ShiftAssignmentsBulkUpdate(BaseModel):
    assignments: List[ShiftAssignmentItem] = Field(default_factory=list)


class ShiftAssignmentResponse(BaseModel):
    id: int
    employee_id: int = Field(..., alias="employeeId")
    employee_name: Optional[str] = Field(None, alias="employeeName")
    work_date: date = Field(..., alias="workDate")
    shift_id: Optional[int] = Field(None, alias="shiftId")
    shift_code: Optional[str] = Field(None, alias="shiftCode")
    shift_name: Optional[str] = Field(None, alias="shiftName")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ShiftRosterResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    scope_type: str = Field("work_group", alias="scopeType")
    work_group_id: Optional[int] = Field(None, alias="workGroupId")
    work_group_code: Optional[str] = Field(None, alias="workGroupCode")
    work_group_name: Optional[str] = Field(None, alias="workGroupName")
    employee_id: Optional[int] = Field(None, alias="employeeId")
    employee_name: Optional[str] = Field(None, alias="employeeName")
    period_start: date = Field(..., alias="periodStart")
    period_end: date = Field(..., alias="periodEnd")
    status: str
    published_at: Optional[datetime] = Field(None, alias="publishedAt")
    remarks: Optional[str] = None
    assignments: List[ShiftAssignmentResponse] = Field(default_factory=list)
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
