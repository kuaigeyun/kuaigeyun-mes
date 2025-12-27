"""
薪资发放 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SalaryPaymentBase(BaseModel):
    """薪资发放基础 Schema"""
    
    payment_no: str = Field(..., max_length=50, description="发放编号（组织内唯一）")
    payment_period: str = Field(..., max_length=20, description="发放期间（格式：2024-01）")
    payment_date: datetime = Field(..., description="发放日期")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    calculation_id: Optional[int] = Field(None, description="薪资计算ID")
    payment_amount: Decimal = Field(..., ge=Decimal("0"), description="发放金额")
    payment_method: str = Field(..., max_length=50, description="发放方式（银行转账、现金、其他）")
    bank_account: Optional[str] = Field(None, max_length=50, description="银行账号")
    status: str = Field("待发放", max_length=20, description="状态（待发放、已发放、已取消）")
    
    @validator("payment_no")
    def validate_payment_no(cls, v):
        if not v or not v.strip():
            raise ValueError("发放编号不能为空")
        return v.strip()


class SalaryPaymentCreate(SalaryPaymentBase):
    pass


class SalaryPaymentUpdate(BaseModel):
    payment_period: Optional[str] = Field(None, max_length=20)
    payment_date: Optional[datetime] = None
    employee_name: Optional[str] = Field(None, max_length=100)
    calculation_id: Optional[int] = None
    payment_amount: Optional[Decimal] = Field(None, ge=Decimal("0"))
    payment_method: Optional[str] = Field(None, max_length=50)
    bank_account: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=20)


class SalaryPaymentResponse(SalaryPaymentBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

