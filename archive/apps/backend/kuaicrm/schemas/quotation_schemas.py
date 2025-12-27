"""
报价单 Schema 模块

定义报价单的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class QuotationBase(BaseModel):
    """报价单基础 Schema"""
    
    quotation_no: str = Field(..., max_length=50, alias="quotationNo", description="报价单编号")
    quotation_date: datetime = Field(..., alias="quotationDate", description="报价日期")
    customer_id: int = Field(..., alias="customerId", description="客户ID（关联master-data）")
    opportunity_id: Optional[int] = Field(None, alias="opportunityId", description="关联商机ID（可选）")
    lead_id: Optional[int] = Field(None, alias="leadId", description="关联线索ID（可选）")
    status: str = Field("草稿", max_length=50, description="报价单状态")
    total_amount: Decimal = Field(..., alias="totalAmount", description="报价金额")
    valid_until: Optional[datetime] = Field(None, alias="validUntil", description="有效期至")
    description: Optional[str] = Field(None, description="描述")
    terms: Optional[str] = Field(None, description="条款说明")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许使用字段名或别名
        by_alias=True  # 序列化时使用别名
    )
    
    @validator("quotation_no")
    def validate_quotation_no(cls, v):
        """验证报价单编号格式"""
        if not v or not v.strip():
            raise ValueError("报价单编号不能为空")
        return v.strip().upper()
    
    @validator("status")
    def validate_status(cls, v):
        """验证报价单状态"""
        allowed_statuses = ["草稿", "已发送", "已接受", "已拒绝", "已过期"]
        if v not in allowed_statuses:
            raise ValueError(f"报价单状态必须是: {', '.join(allowed_statuses)}")
        return v
    
    @validator("total_amount")
    def validate_total_amount(cls, v):
        """验证报价金额"""
        if v <= 0:
            raise ValueError("报价金额必须大于0")
        return v


class QuotationCreate(QuotationBase):
    """创建报价单 Schema"""
    pass


class QuotationUpdate(BaseModel):
    """更新报价单 Schema"""
    
    quotation_date: Optional[datetime] = Field(None, alias="quotationDate", description="报价日期")
    customer_id: Optional[int] = Field(None, alias="customerId", description="客户ID")
    opportunity_id: Optional[int] = Field(None, alias="opportunityId", description="关联商机ID")
    lead_id: Optional[int] = Field(None, alias="leadId", description="关联线索ID")
    status: Optional[str] = Field(None, max_length=50, description="报价单状态")
    total_amount: Optional[Decimal] = Field(None, alias="totalAmount", description="报价金额")
    valid_until: Optional[datetime] = Field(None, alias="validUntil", description="有效期至")
    description: Optional[str] = Field(None, description="描述")
    terms: Optional[str] = Field(None, description="条款说明")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许使用字段名或别名
        by_alias=True  # 序列化时使用别名
    )
    
    @validator("status")
    def validate_status(cls, v):
        """验证报价单状态"""
        if v is not None:
            allowed_statuses = ["草稿", "已发送", "已接受", "已拒绝", "已过期"]
            if v not in allowed_statuses:
                raise ValueError(f"报价单状态必须是: {', '.join(allowed_statuses)}")
        return v
    
    @validator("total_amount")
    def validate_total_amount(cls, v):
        """验证报价金额"""
        if v is not None and v <= 0:
            raise ValueError("报价金额必须大于0")
        return v


class QuotationResponse(QuotationBase):
    """报价单响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    customer_id: int = Field(..., alias="customerId", description="客户ID")
    opportunity_id: Optional[int] = Field(None, alias="opportunityId", description="关联商机ID")
    lead_id: Optional[int] = Field(None, alias="leadId", description="关联线索ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )

