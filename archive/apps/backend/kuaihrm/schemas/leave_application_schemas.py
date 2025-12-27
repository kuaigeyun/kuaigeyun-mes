"""
请假申请 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class LeaveApplicationBase(BaseModel):
    """请假申请基础 Schema"""
    
    application_no: str = Field(..., max_length=50, description="申请编号（组织内唯一）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    leave_type: str = Field(..., max_length=50, description="请假类型（年假、病假、事假、调休、其他）")
    start_date: datetime = Field(..., description="开始日期")
    end_date: datetime = Field(..., description="结束日期")
    leave_days: Decimal = Field(..., ge=Decimal("0"), description="请假天数")
    leave_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="请假小时数")
    leave_reason: Optional[str] = Field(None, description="请假原因")
    status: str = Field("待审批", max_length=20, description="状态（待审批、已审批、已拒绝、已取消）")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态")
    
    @validator("application_no")
    def validate_application_no(cls, v):
        if not v or not v.strip():
            raise ValueError("申请编号不能为空")
        return v.strip()


class LeaveApplicationCreate(LeaveApplicationBase):
    pass


class LeaveApplicationUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    leave_type: Optional[str] = Field(None, max_length=50)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    leave_days: Optional[Decimal] = Field(None, ge=Decimal("0"))
    leave_hours: Optional[Decimal] = Field(None, ge=Decimal("0"))
    leave_reason: Optional[str] = None
    status: Optional[str] = Field(None, max_length=20)


class LeaveApplicationResponse(LeaveApplicationBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

