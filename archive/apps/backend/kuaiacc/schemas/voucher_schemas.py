"""
凭证 Schema 模块

定义凭证数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范设计。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class VoucherBase(BaseModel):
    """凭证基础 Schema"""
    
    voucher_no: str = Field(..., max_length=50, description="凭证编号（组织内唯一，格式：记-001、收-001、付-001、转-001）")
    voucher_date: datetime = Field(..., description="凭证日期")
    voucher_type: str = Field(..., max_length=50, description="凭证类型（记账凭证、收款凭证、付款凭证、转账凭证）")
    attachment_count: int = Field(0, ge=0, description="附件数量（中国财务凭证通常需要附件）")
    summary: Optional[str] = Field(None, description="摘要")
    total_debit: Decimal = Field(Decimal("0.00"), description="借方合计")
    total_credit: Decimal = Field(Decimal("0.00"), description="贷方合计")
    status: str = Field("草稿", max_length=20, description="状态（草稿、已审核、已过账、已作废）")
    created_by: int = Field(..., description="制单人ID")
    reviewed_by: Optional[int] = Field(None, description="审核人ID")
    reviewed_at: Optional[datetime] = Field(None, description="审核时间")
    posted_by: Optional[int] = Field(None, description="过账人ID")
    posted_at: Optional[datetime] = Field(None, description="过账时间")
    is_balanced: bool = Field(False, description="是否借贷平衡（必须平衡才能过账）")
    
    @validator("voucher_no")
    def validate_voucher_no(cls, v):
        """验证凭证编号格式"""
        if not v or not v.strip():
            raise ValueError("凭证编号不能为空")
        return v.strip()
    
    @validator("voucher_type")
    def validate_voucher_type(cls, v):
        """验证凭证类型"""
        allowed_types = ["记账凭证", "收款凭证", "付款凭证", "转账凭证"]
        if v not in allowed_types:
            raise ValueError(f"凭证类型必须是以下之一：{', '.join(allowed_types)}")
        return v
    
    @validator("total_debit", "total_credit")
    def validate_amount(cls, v):
        """验证金额"""
        if v < 0:
            raise ValueError("金额不能为负数")
        return v


class VoucherCreate(VoucherBase):
    """创建凭证 Schema"""
    pass


class VoucherUpdate(BaseModel):
    """更新凭证 Schema"""
    
    voucher_date: Optional[datetime] = Field(None, description="凭证日期")
    voucher_type: Optional[str] = Field(None, max_length=50, description="凭证类型")
    attachment_count: Optional[int] = Field(None, ge=0, description="附件数量")
    summary: Optional[str] = Field(None, description="摘要")
    total_debit: Optional[Decimal] = Field(None, description="借方合计")
    total_credit: Optional[Decimal] = Field(None, description="贷方合计")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    reviewed_by: Optional[int] = Field(None, description="审核人ID")
    reviewed_at: Optional[datetime] = Field(None, description="审核时间")
    posted_by: Optional[int] = Field(None, description="过账人ID")
    posted_at: Optional[datetime] = Field(None, description="过账时间")
    is_balanced: Optional[bool] = Field(None, description="是否借贷平衡")


class VoucherResponse(VoucherBase):
    """凭证响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class VoucherEntryBase(BaseModel):
    """凭证分录基础 Schema"""
    
    voucher_id: int = Field(..., description="凭证ID（关联Voucher）")
    entry_no: int = Field(..., ge=1, description="分录序号")
    subject_id: int = Field(..., description="科目ID（关联AccountSubject）")
    subject_code: str = Field(..., max_length=50, description="科目编码")
    subject_name: str = Field(..., max_length=200, description="科目名称")
    debit_amount: Decimal = Field(Decimal("0.00"), description="借方金额")
    credit_amount: Decimal = Field(Decimal("0.00"), description="贷方金额")
    customer_id: Optional[int] = Field(None, description="客户ID（辅助核算：客户）")
    supplier_id: Optional[int] = Field(None, description="供应商ID（辅助核算：供应商）")
    department_id: Optional[int] = Field(None, description="部门ID（辅助核算：部门）")
    project_id: Optional[int] = Field(None, description="项目ID（辅助核算：项目）")
    employee_id: Optional[int] = Field(None, description="员工ID（辅助核算：员工）")
    quantity: Optional[Decimal] = Field(None, description="数量（用于数量金额式账页）")
    unit_price: Optional[Decimal] = Field(None, description="单价（用于数量金额式账页）")
    summary: Optional[str] = Field(None, description="摘要")
    
    @validator("debit_amount", "credit_amount")
    def validate_amount(cls, v):
        """验证金额"""
        if v < 0:
            raise ValueError("金额不能为负数")
        return v


class VoucherEntryCreate(VoucherEntryBase):
    """创建凭证分录 Schema"""
    pass


class VoucherEntryUpdate(BaseModel):
    """更新凭证分录 Schema"""
    
    entry_no: Optional[int] = Field(None, ge=1, description="分录序号")
    subject_id: Optional[int] = Field(None, description="科目ID")
    subject_code: Optional[str] = Field(None, max_length=50, description="科目编码")
    subject_name: Optional[str] = Field(None, max_length=200, description="科目名称")
    debit_amount: Optional[Decimal] = Field(None, description="借方金额")
    credit_amount: Optional[Decimal] = Field(None, description="贷方金额")
    customer_id: Optional[int] = Field(None, description="客户ID")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    department_id: Optional[int] = Field(None, description="部门ID")
    project_id: Optional[int] = Field(None, description="项目ID")
    employee_id: Optional[int] = Field(None, description="员工ID")
    quantity: Optional[Decimal] = Field(None, description="数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    summary: Optional[str] = Field(None, description="摘要")


class VoucherEntryResponse(VoucherEntryBase):
    """凭证分录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

