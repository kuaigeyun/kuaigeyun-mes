"""
打卡记录 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class AttendanceRecordBase(BaseModel):
    """打卡记录基础 Schema"""
    
    record_date: datetime = Field(..., description="打卡日期")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    rule_id: Optional[int] = Field(None, description="考勤规则ID")
    check_in_time: Optional[datetime] = Field(None, description="上班打卡时间")
    check_out_time: Optional[datetime] = Field(None, description="下班打卡时间")
    check_in_location: Optional[str] = Field(None, max_length=200, description="上班打卡位置（GPS坐标）")
    check_out_location: Optional[str] = Field(None, max_length=200, description="下班打卡位置（GPS坐标）")
    check_in_method: Optional[str] = Field(None, max_length=50, description="上班打卡方式")
    check_out_method: Optional[str] = Field(None, max_length=50, description="下班打卡方式")
    work_hours: Optional[Decimal] = Field(None, description="工作时长（小时）")
    is_late: bool = Field(False, description="是否迟到")
    is_early_leave: bool = Field(False, description="是否早退")
    is_absent: bool = Field(False, description="是否缺勤")
    is_overtime: bool = Field(False, description="是否加班")
    overtime_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="加班时长（小时）")
    status: str = Field("正常", max_length=20, description="状态（正常、迟到、早退、缺勤、异常）")
    remark: Optional[str] = Field(None, description="备注")


class AttendanceRecordCreate(AttendanceRecordBase):
    pass


class AttendanceRecordUpdate(BaseModel):
    rule_id: Optional[int] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    check_in_location: Optional[str] = Field(None, max_length=200)
    check_out_location: Optional[str] = Field(None, max_length=200)
    check_in_method: Optional[str] = Field(None, max_length=50)
    check_out_method: Optional[str] = Field(None, max_length=50)
    work_hours: Optional[Decimal] = None
    is_late: Optional[bool] = None
    is_early_leave: Optional[bool] = None
    is_absent: Optional[bool] = None
    is_overtime: Optional[bool] = None
    overtime_hours: Optional[Decimal] = Field(None, ge=Decimal("0"))
    status: Optional[str] = Field(None, max_length=20)
    remark: Optional[str] = None


class AttendanceRecordResponse(AttendanceRecordBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

