"""
客户发票 Schema 模块

定义客户发票数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范：增值税发票管理。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CustomerInvoiceBase(BaseModel):
    """客户发票基础 Schema"""
    
    invoice_no: str = Field(..., max_length=50, description="发票编号（组织内唯一）")
    invoice_code: Optional[str] = Field(None, max_length=50, description="发票代码（增值税发票代码）")
    invoice_number: Optional[str] = Field(None, max_length=50, description="发票号码（增值税发票号码）")
    invoice_type: str = Field(..., max_length=50, description="发票类型（增值税专用发票、增值税普通发票、普通发票）")
    invoice_date: datetime = Field(..., description="开票日期")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID（关联CRM）")
    tax_rate: Decimal = Field(Decimal("0.13"), ge=Decimal("0"), le=Decimal("1"), description="税率（增值税税率，如0.13表示13%）")
    amount_excluding_tax: Decimal = Field(..., ge=Decimal("0"), description="不含税金额")
    tax_amount: Decimal = Field(..., ge=Decimal("0"), description="税额")
    amount_including_tax: Decimal = Field(..., ge=Decimal("0"), description="含税金额")
    status: str = Field("待开票", max_length=20, description="状态（待开票、已开票、已作废、已红冲）")
    voucher_id: Optional[int] = Field(None, description="凭证ID（关联Voucher，自动生成凭证）")
    
    @validator("invoice_no")
    def validate_invoice_no(cls, v):
        """验证发票编号格式"""
        if not v or not v.strip():
            raise ValueError("发票编号不能为空")
        return v.strip()
    
    @validator("invoice_type")
    def validate_invoice_type(cls, v):
        """验证发票类型"""
        allowed_types = ["增值税专用发票", "增值税普通发票", "普通发票"]
        if v not in allowed_types:
            raise ValueError(f"发票类型必须是以下之一：{', '.join(allowed_types)}")
        return v
    
    @validator("amount_including_tax")
    def validate_amount_including_tax(cls, v, values):
        """验证含税金额（应该等于不含税金额+税额）"""
        if "amount_excluding_tax" in values and "tax_amount" in values:
            expected = values["amount_excluding_tax"] + values["tax_amount"]
            if abs(v - expected) > Decimal("0.01"):  # 允许0.01的误差
                raise ValueError(f"含税金额应该等于不含税金额+税额：{expected}，实际：{v}")
        return v


class CustomerInvoiceCreate(CustomerInvoiceBase):
    """创建客户发票 Schema"""
    pass


class CustomerInvoiceUpdate(BaseModel):
    """更新客户发票 Schema"""
    
    invoice_code: Optional[str] = Field(None, max_length=50, description="发票代码")
    invoice_number: Optional[str] = Field(None, max_length=50, description="发票号码")
    invoice_type: Optional[str] = Field(None, max_length=50, description="发票类型")
    invoice_date: Optional[datetime] = Field(None, description="开票日期")
    customer_id: Optional[int] = Field(None, description="客户ID")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    tax_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("1"), description="税率")
    amount_excluding_tax: Optional[Decimal] = Field(None, ge=Decimal("0"), description="不含税金额")
    tax_amount: Optional[Decimal] = Field(None, ge=Decimal("0"), description="税额")
    amount_including_tax: Optional[Decimal] = Field(None, ge=Decimal("0"), description="含税金额")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    voucher_id: Optional[int] = Field(None, description="凭证ID")


class CustomerInvoiceResponse(CustomerInvoiceBase):
    """客户发票响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

