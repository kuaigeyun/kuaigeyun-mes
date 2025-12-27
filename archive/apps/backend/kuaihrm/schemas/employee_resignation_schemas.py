"""
员工离职 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class EmployeeResignationBase(BaseModel):
    """员工离职基础 Schema"""
    
    resignation_no: str = Field(..., max_length=50, description="离职编号（组织内唯一）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    resignation_date: datetime = Field(..., description="离职日期")
    resignation_reason: Optional[str] = Field(None, description="离职原因")
    status: str = Field("待申请", max_length=20, description="状态（待申请、待审批、待办理、办理中、已交接、已确认、已取消）")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态")
    
    @validator("resignation_no")
    def validate_resignation_no(cls, v):
        if not v or not v.strip():
            raise ValueError("离职编号不能为空")
        return v.strip()


class EmployeeResignationCreate(EmployeeResignationBase):
    pass


class EmployeeResignationUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    resignation_date: Optional[datetime] = None
    resignation_reason: Optional[str] = None
    status: Optional[str] = Field(None, max_length=20)


class EmployeeResignationResponse(EmployeeResignationBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

