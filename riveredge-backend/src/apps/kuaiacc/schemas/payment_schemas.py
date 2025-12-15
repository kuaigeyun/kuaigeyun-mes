"""
付款管理 Schema 模块

定义付款数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范：付款核销管理。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class PaymentBase(BaseModel):
    """付款基础 Schema"""
    
    payment_no: str = Field(..., max_length=50, description="付款单编号（组织内唯一）")
    payment_date: datetime = Field(..., description="付款日期")
    supplier_id: int = Field(..., description="供应商ID（关联master-data）")
    payment_type: str = Field(..., max_length=50, description="付款类型（预付款、应付款、其他）")
    payment_method: str = Field(..., max_length=50, description="付款方式（现金、银行转账、支票、汇票等）")
    amount: Decimal = Field(..., ge=Decimal("0"), description="付款金额")
    currency: str = Field("CNY", max_length=10, description="币种（人民币、美元等，默认人民币）")
    exchange_rate: Decimal = Field(Decimal("1.000000"), ge=Decimal("0"), description="汇率（外币付款时使用）")
    status: str = Field("待审批", max_length=20, description="状态（待审批、已审批、待核销、部分核销、已核销）")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID（关联ApprovalInstance）")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态（pending、approved、rejected、cancelled）")
    voucher_id: Optional[int] = Field(None, description="凭证ID（关联Voucher，自动生成凭证）")
    
    @validator("payment_no")
    def validate_payment_no(cls, v):
        """验证付款单编号格式"""
        if not v or not v.strip():
            raise ValueError("付款单编号不能为空")
        return v.strip()
    
    @validator("payment_type")
    def validate_payment_type(cls, v):
        """验证付款类型"""
        allowed_types = ["预付款", "应付款", "其他"]
        if v not in allowed_types:
            raise ValueError(f"付款类型必须是以下之一：{', '.join(allowed_types)}")
        return v


class PaymentCreate(PaymentBase):
    """创建付款 Schema"""
    pass


class PaymentUpdate(BaseModel):
    """更新付款 Schema"""
    
    payment_date: Optional[datetime] = Field(None, description="付款日期")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    payment_type: Optional[str] = Field(None, max_length=50, description="付款类型")
    payment_method: Optional[str] = Field(None, max_length=50, description="付款方式")
    amount: Optional[Decimal] = Field(None, ge=Decimal("0"), description="付款金额")
    currency: Optional[str] = Field(None, max_length=10, description="币种")
    exchange_rate: Optional[Decimal] = Field(None, ge=Decimal("0"), description="汇率")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    approval_instance_id: Optional[int] = Field(None, description="审批实例ID")
    approval_status: Optional[str] = Field(None, max_length=20, description="审批状态")
    voucher_id: Optional[int] = Field(None, description="凭证ID")


class PaymentResponse(PaymentBase):
    """付款响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

