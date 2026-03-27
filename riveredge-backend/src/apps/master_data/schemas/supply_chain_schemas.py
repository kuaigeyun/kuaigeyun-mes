"""
供应链数据 Schema 模块

定义供应链数据的 Pydantic Schema（客户、供应商），用于数据验证和序列化。
"""

from decimal import Decimal

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional
from datetime import datetime


class CustomerBase(BaseModel):
    """客户基础 Schema"""

    code: str = Field(..., max_length=50, description="客户编码")
    name: str = Field(..., max_length=200, description="客户名称")
    short_name: Optional[str] = Field(None, max_length=100, description="简称", alias="shortName")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人", alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    email: Optional[str] = Field(None, max_length=100, description="邮箱")
    address: Optional[str] = Field(None, description="地址")
    category: Optional[str] = Field(None, max_length=50, description="客户分类")
    salesman_id: Optional[int] = Field(None, description="归属业务员ID", alias="salesmanId")
    salesman_name: Optional[str] = Field(None, max_length=100, description="归属业务员姓名", alias="salesmanName")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    customer_level_code: Optional[str] = Field(None, max_length=50, description="客户级别字典值", alias="customerLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购量", alias="estimatedAnnualPurchase")
    lead_source_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="leadSourceCode")
    credit_limit: Optional[Decimal] = Field(None, description="信用额度", alias="creditLimit")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    is_public: bool = Field(False, alias="isPublic", description="是否公共（false=私有，true=公共）")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("客户编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("客户名称不能为空")
        return v.strip()


class CustomerCreate(CustomerBase):
    """创建客户 Schema"""
    pass


class CustomerUpdate(BaseModel):
    """更新客户 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="客户编码")
    name: Optional[str] = Field(None, max_length=200, description="客户名称")
    short_name: Optional[str] = Field(None, max_length=100, description="简称", alias="shortName")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人", alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    email: Optional[str] = Field(None, max_length=100, description="邮箱")
    address: Optional[str] = Field(None, description="地址")
    category: Optional[str] = Field(None, max_length=50, description="客户分类")
    salesman_id: Optional[int] = Field(None, description="归属业务员ID", alias="salesmanId")
    salesman_name: Optional[str] = Field(None, max_length=100, description="归属业务员姓名", alias="salesmanName")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    customer_level_code: Optional[str] = Field(None, max_length=50, description="客户级别字典值", alias="customerLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购量", alias="estimatedAnnualPurchase")
    lead_source_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="leadSourceCode")
    credit_limit: Optional[Decimal] = Field(None, description="信用额度", alias="creditLimit")
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")
    is_public: Optional[bool] = Field(None, alias="isPublic", description="是否公共（false=私有，true=公共）")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("客户编码不能为空")
        return v.strip().upper() if v else None

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("客户名称不能为空")
        return v.strip() if v else None


class CustomerResponse(CustomerBase):
    """客户响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID", alias="tenantId")
    created_at: datetime = Field(..., description="创建时间", alias="createdAt")
    updated_at: datetime = Field(..., description="更新时间", alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, description="删除时间", alias="deletedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class SupplierBase(BaseModel):
    """供应商基础 Schema"""

    code: str = Field(..., max_length=50, description="供应商编码")
    name: str = Field(..., max_length=200, description="供应商名称")
    short_name: Optional[str] = Field(None, max_length=100, description="简称", alias="shortName")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人", alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    email: Optional[str] = Field(None, max_length=100, description="邮箱")
    address: Optional[str] = Field(None, description="地址")
    category: Optional[str] = Field(None, max_length=50, description="供应商分类")
    buyer_id: Optional[int] = Field(None, description="归属采购员ID", alias="buyerId")
    buyer_name: Optional[str] = Field(None, max_length=100, description="归属采购员姓名", alias="buyerName")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    supplier_level_code: Optional[str] = Field(None, max_length=50, description="供应商级别字典值", alias="supplierLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购额", alias="estimatedAnnualPurchase")
    source_channel_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="sourceChannelCode")
    credit_limit: Optional[Decimal] = Field(None, description="授信额度", alias="creditLimit")
    is_active: bool = Field(True, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("供应商编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("供应商名称不能为空")
        return v.strip()


class SupplierCreate(SupplierBase):
    """创建供应商 Schema"""
    pass


class SupplierUpdate(BaseModel):
    """更新供应商 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="供应商编码")
    name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    short_name: Optional[str] = Field(None, max_length=100, description="简称", alias="shortName")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人", alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    email: Optional[str] = Field(None, max_length=100, description="邮箱")
    address: Optional[str] = Field(None, description="地址")
    category: Optional[str] = Field(None, max_length=50, description="供应商分类")
    buyer_id: Optional[int] = Field(None, description="归属采购员ID", alias="buyerId")
    buyer_name: Optional[str] = Field(None, max_length=100, description="归属采购员姓名", alias="buyerName")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    supplier_level_code: Optional[str] = Field(None, max_length=50, description="供应商级别字典值", alias="supplierLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购额", alias="estimatedAnnualPurchase")
    source_channel_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="sourceChannelCode")
    credit_limit: Optional[Decimal] = Field(None, description="授信额度", alias="creditLimit")
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("供应商编码不能为空")
        return v.strip().upper() if v else None

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("供应商名称不能为空")
        return v.strip() if v else None


class SupplierResponse(SupplierBase):
    """供应商响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID", alias="tenantId")
    created_at: datetime = Field(..., description="创建时间", alias="createdAt")
    updated_at: datetime = Field(..., description="更新时间", alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, description="删除时间", alias="deletedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)

