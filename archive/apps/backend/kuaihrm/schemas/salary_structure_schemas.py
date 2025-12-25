"""
薪资结构 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SalaryStructureBase(BaseModel):
    """薪资结构基础 Schema"""
    
    structure_code: str = Field(..., max_length=50, description="结构编码（组织内唯一）")
    structure_name: str = Field(..., max_length=200, description="结构名称")
    structure_type: str = Field(..., max_length=50, description="结构类型（固定薪资、绩效薪资、计件薪资等）")
    base_salary: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="基本工资")
    performance_salary: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="绩效工资")
    allowance: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="津贴")
    bonus: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="奖金")
    deduction: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="扣款")
    total_salary: Decimal = Field(..., ge=Decimal("0"), description="总薪资")
    status: str = Field("启用", max_length=20, description="状态（启用、停用）")
    
    @validator("structure_code")
    def validate_structure_code(cls, v):
        if not v or not v.strip():
            raise ValueError("结构编码不能为空")
        return v.strip()


class SalaryStructureCreate(SalaryStructureBase):
    pass


class SalaryStructureUpdate(BaseModel):
    structure_name: Optional[str] = Field(None, max_length=200)
    structure_type: Optional[str] = Field(None, max_length=50)
    base_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    performance_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    allowance: Optional[Decimal] = Field(None, ge=Decimal("0"))
    bonus: Optional[Decimal] = Field(None, ge=Decimal("0"))
    deduction: Optional[Decimal] = Field(None, ge=Decimal("0"))
    total_salary: Optional[Decimal] = Field(None, ge=Decimal("0"))
    status: Optional[str] = Field(None, max_length=20)


class SalaryStructureResponse(SalaryStructureBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

