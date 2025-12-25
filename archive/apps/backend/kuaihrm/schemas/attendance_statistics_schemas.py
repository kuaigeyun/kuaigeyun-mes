"""
考勤统计 Schema 模块
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class AttendanceStatisticsBase(BaseModel):
    """考勤统计基础 Schema"""
    
    statistics_period: str = Field(..., max_length=20, description="统计期间（格式：2024-01）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    work_days: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="应出勤天数")
    actual_work_days: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="实际出勤天数")
    leave_days: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="请假天数")
    overtime_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="加班小时数")
    late_count: int = Field(0, ge=0, description="迟到次数")
    early_leave_count: int = Field(0, ge=0, description="早退次数")
    absent_count: int = Field(0, ge=0, description="缺勤次数")


class AttendanceStatisticsCreate(AttendanceStatisticsBase):
    pass


class AttendanceStatisticsUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    work_days: Optional[Decimal] = Field(None, ge=Decimal("0"))
    actual_work_days: Optional[Decimal] = Field(None, ge=Decimal("0"))
    leave_days: Optional[Decimal] = Field(None, ge=Decimal("0"))
    overtime_hours: Optional[Decimal] = Field(None, ge=Decimal("0"))
    late_count: Optional[int] = Field(None, ge=0)
    early_leave_count: Optional[int] = Field(None, ge=0)
    absent_count: Optional[int] = Field(None, ge=0)


class AttendanceStatisticsResponse(AttendanceStatisticsBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

