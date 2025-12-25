"""
员工入职 Schema 模块

定义员工入职数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class EmployeeOnboardingBase(BaseModel):
    """员工入职基础 Schema"""
    
    onboarding_no: str = Field(..., max_length=50, description="入职编号（组织内唯一）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    department_id: Optional[int] = Field(None, description="部门ID（关联master-data）")
    position_id: Optional[int] = Field(None, description="岗位ID（关联master-data）")
    onboarding_date: datetime = Field(..., description="入职日期")
    status: str = Field("待申请", max_length=20, description="状态（待申请、待审批、待办理、办理中、已确认、已取消）")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID（关联ApprovalInstance）")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态")
    
    @validator("onboarding_no")
    def validate_onboarding_no(cls, v):
        """验证入职编号格式"""
        if not v or not v.strip():
            raise ValueError("入职编号不能为空")
        return v.strip()


class EmployeeOnboardingCreate(EmployeeOnboardingBase):
    """创建员工入职 Schema"""
    pass


class EmployeeOnboardingUpdate(BaseModel):
    """更新员工入职 Schema"""
    
    employee_name: Optional[str] = Field(None, max_length=100, description="员工姓名")
    department_id: Optional[int] = Field(None, description="部门ID")
    position_id: Optional[int] = Field(None, description="岗位ID")
    onboarding_date: Optional[datetime] = Field(None, description="入职日期")
    status: Optional[str] = Field(None, max_length=20, description="状态")


class EmployeeOnboardingResponse(EmployeeOnboardingBase):
    """员工入职响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

