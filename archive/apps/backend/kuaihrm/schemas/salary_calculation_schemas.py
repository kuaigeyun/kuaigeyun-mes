"""
薪资计算 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SalaryCalculationBase(BaseModel):
    """薪资计算基础 Schema"""
    
    calculation_no: str = Field(..., max_length=50, description="计算编号（组织内唯一）")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    salary_period: str = Field(..., max_length=20, description="薪资期间（格式：2024-01）")
    structure_id: Optional[int] = Field(None, description="薪资结构ID")
    base_salary: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="基本工资")
    performance_salary: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="绩效工资")
    allowance: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="津贴")
    bonus: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="奖金")
    deduction: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="扣款")
    social_security: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="社保扣款")
    tax: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="个税扣款")
    total_salary: Decimal = Field(..., ge=Decimal("0"), description="应发工资")
    actual_salary: Decimal = Field(..., ge=Decimal("0"), description="实发工资")
    status: str = Field("待计算", max_length=20, description="状态（待计算、已计算、已确认、已发放）")
    
    @validator("calculation_no")
    def validate_calculation_no(cls, v):
        if not v or not v.strip():
            raise ValueError("计算编号不能为空")
        return v.strip()


class SalaryCalculationCreate(SalaryCalculationBase):
    pass


class SalaryCalculationUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    structure_id: Optional[int] = None
    base_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    performance_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    allowance: Optional[Decimal] = Field(None, ge=Decimal("0"))
    bonus: Optional[Decimal] = Field(None, ge=Decimal("0"))
    deduction: Optional[Decimal] = Field(None, ge=Decimal("0"))
    social_security: Optional[Decimal] = Field(None, ge=Decimal("0"))
    tax: Optional[Decimal] = Field(None, ge=Decimal("0"))
    total_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    actual_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    status: Optional[str] = Field(None, max_length=20)


class SalaryCalculationResponse(SalaryCalculationBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

