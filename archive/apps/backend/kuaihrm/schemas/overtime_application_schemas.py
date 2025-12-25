"""
加班申请 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class OvertimeApplicationBase(BaseModel):
    """加班申请基础 Schema"""
    
    application_no: str = Field(..., max_length=50, description="申请编号（组织内唯一）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    overtime_date: datetime = Field(..., description="加班日期")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    overtime_hours: Decimal = Field(..., ge=Decimal("0"), description="加班时长（小时）")
    overtime_reason: Optional[str] = Field(None, description="加班原因")
    status: str = Field("待审批", max_length=20, description="状态（待审批、已审批、已拒绝、已取消）")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态")
    
    @validator("application_no")
    def validate_application_no(cls, v):
        if not v or not v.strip():
            raise ValueError("申请编号不能为空")
        return v.strip()


class OvertimeApplicationCreate(OvertimeApplicationBase):
    pass


class OvertimeApplicationUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    overtime_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    overtime_hours: Optional[Decimal] = Field(None, ge=Decimal("0"))
    overtime_reason: Optional[str] = None
    status: Optional[str] = Field(None, max_length=20)


class OvertimeApplicationResponse(OvertimeApplicationBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

