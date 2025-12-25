"""
社保个税 Schema 模块
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SocialSecurityTaxBase(BaseModel):
    """社保个税基础 Schema"""
    
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    social_security_base: Decimal = Field(..., ge=Decimal("0"), description="社保基数")
    pension_rate: Decimal = Field(Decimal("0.08"), ge=Decimal("0"), le=Decimal("1"), description="养老保险费率")
    medical_rate: Decimal = Field(Decimal("0.02"), ge=Decimal("0"), le=Decimal("1"), description="医疗保险费率")
    unemployment_rate: Decimal = Field(Decimal("0.005"), ge=Decimal("0"), le=Decimal("1"), description="失业保险费率")
    work_injury_rate: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), le=Decimal("1"), description="工伤保险费率")
    maternity_rate: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), le=Decimal("1"), description="生育保险费率")
    housing_fund_rate: Decimal = Field(Decimal("0.12"), ge=Decimal("0"), le=Decimal("1"), description="住房公积金费率")
    social_security_amount: Decimal = Field(..., ge=Decimal("0"), description="社保总额")
    tax_base: Decimal = Field(..., ge=Decimal("0"), description="个税基数")
    tax_rate: Decimal = Field(..., ge=Decimal("0"), le=Decimal("1"), description="个税税率")
    tax_amount: Decimal = Field(..., ge=Decimal("0"), description="个税金额")
    effective_date: datetime = Field(..., description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    status: str = Field("启用", max_length=20, description="状态（启用、停用）")


class SocialSecurityTaxCreate(SocialSecurityTaxBase):
    pass


class SocialSecurityTaxUpdate(BaseModel):
    employee_name: Optional[str] = Field(None, max_length=100)
    social_security_base: Optional[Decimal] = Field(None, ge=Decimal("0"))
    pension_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    medical_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    unemployment_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    work_injury_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    maternity_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    housing_fund_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    social_security_amount: Optional[Decimal] = Field(None, ge=Decimal("0"))
    tax_base: Optional[Decimal] = Field(None, ge=Decimal("0"))
    tax_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"))
    tax_amount: Optional[Decimal] = Field(None, ge=Decimal("0"))
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: Optional[str] = Field(None, max_length=20)


class SocialSecurityTaxResponse(SocialSecurityTaxBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

