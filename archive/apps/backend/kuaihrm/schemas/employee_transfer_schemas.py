"""
员工异动 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class EmployeeTransferBase(BaseModel):
    """员工异动基础 Schema"""
    
    transfer_no: str = Field(..., max_length=50, description="异动编号（组织内唯一）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    transfer_type: str = Field(..., max_length=50, description="异动类型（调岗、晋升、降职、其他）")
    old_department_id: Optional[int] = Field(None, description="原部门ID")
    old_position_id: Optional[int] = Field(None, description="原岗位ID")
    new_department_id: Optional[int] = Field(None, description="新部门ID")
    new_position_id: Optional[int] = Field(None, description="新岗位ID")
    transfer_date: datetime = Field(..., description="异动日期")
    transfer_reason: Optional[str] = Field(None, description="异动原因")
    status: str = Field("待申请", max_length=20, description="状态（待申请、待审批、待办理、办理中、已确认、已取消）")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态")
    
    @validator("transfer_no")
    def validate_transfer_no(cls, v):
        if not v or not v.strip():
            raise ValueError("异动编号不能为空")
        return v.strip()


class EmployeeTransferCreate(EmployeeTransferBase):
    pass


class EmployeeTransferUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    transfer_type: Optional[str] = Field(None, max_length=50)
    old_department_id: Optional[int] = None
    old_position_id: Optional[int] = None
    new_department_id: Optional[int] = None
    new_position_id: Optional[int] = None
    transfer_date: Optional[datetime] = None
    transfer_reason: Optional[str] = None
    status: Optional[str] = Field(None, max_length=20)


class EmployeeTransferResponse(EmployeeTransferBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

