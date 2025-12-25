"""
收款管理 Schema 模块

定义收款数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范：收款核销管理。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ReceiptBase(BaseModel):
    """收款基础 Schema"""
    
    receipt_no: str = Field(..., max_length=50, description="收款单编号（组织内唯一）")
    receipt_date: datetime = Field(..., description="收款日期")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    receipt_type: str = Field(..., max_length=50, description="收款类型（预收款、应收款、其他）")
    payment_method: str = Field(..., max_length=50, description="收款方式（现金、银行转账、支票、汇票等）")
    amount: Decimal = Field(..., ge=Decimal("0"), description="收款金额")
    currency: str = Field("CNY", max_length=10, description="币种（人民币、美元等，默认人民币）")
    exchange_rate: Decimal = Field(Decimal("1.000000"), ge=Decimal("0"), description="汇率（外币收款时使用）")
    status: str = Field("待核销", max_length=20, description="状态（待核销、部分核销、已核销）")
    voucher_id: Optional[int] = Field(None, description="凭证ID（关联Voucher，自动生成凭证）")
    
    @validator("receipt_no")
    def validate_receipt_no(cls, v):
        """验证收款单编号格式"""
        if not v or not v.strip():
            raise ValueError("收款单编号不能为空")
        return v.strip()
    
    @validator("receipt_type")
    def validate_receipt_type(cls, v):
        """验证收款类型"""
        allowed_types = ["预收款", "应收款", "其他"]
        if v not in allowed_types:
            raise ValueError(f"收款类型必须是以下之一：{', '.join(allowed_types)}")
        return v


class ReceiptCreate(ReceiptBase):
    """创建收款 Schema"""
    pass


class ReceiptUpdate(BaseModel):
    """更新收款 Schema"""
    
    receipt_date: Optional[datetime] = Field(None, description="收款日期")
    customer_id: Optional[int] = Field(None, description="客户ID")
    receipt_type: Optional[str] = Field(None, max_length=50, description="收款类型")
    payment_method: Optional[str] = Field(None, max_length=50, description="收款方式")
    amount: Optional[Decimal] = Field(None, ge=Decimal("0"), description="收款金额")
    currency: Optional[str] = Field(None, max_length=10, description="币种")
    exchange_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), description="汇率")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    voucher_id: Optional[int] = Field(None, description="凭证ID")


class ReceiptResponse(ReceiptBase):
    """收款响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

