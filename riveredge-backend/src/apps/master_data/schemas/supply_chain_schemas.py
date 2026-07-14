"""
供应链数据 Schema 模块

定义供应链数据的 Pydantic Schema（客户、供应商），用于数据验证和序列化。
"""

from decimal import Decimal

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import List, Optional
from datetime import datetime


class PartnerInvoiceAndExtendedMixin(BaseModel):
    """客户/供应商共用的开票资料与扩展字段（API 使用 camelCase alias）"""

    tax_registration_no: Optional[str] = Field(
        None, max_length=50, description="统一社会信用代码/纳税人识别号", alias="taxRegistrationNo"
    )
    invoice_title: Optional[str] = Field(None, max_length=200, description="发票抬头", alias="invoiceTitle")
    invoice_address: Optional[str] = Field(None, description="开票地址", alias="invoiceAddress")
    invoice_phone: Optional[str] = Field(None, max_length=50, description="开票电话", alias="invoicePhone")
    invoice_bank_name: Optional[str] = Field(
        None, max_length=200, description="开票开户银行", alias="invoiceBankName"
    )
    invoice_bank_account: Optional[str] = Field(
        None, max_length=64, description="开票银行账号", alias="invoiceBankAccount"
    )
    invoice_type_code: Optional[str] = Field(
        None, max_length=50, description="发票类型偏好编码", alias="invoiceTypeCode"
    )
    taxpayer_type_code: Optional[str] = Field(
        None, max_length=50, description="纳税人类型编码", alias="taxpayerTypeCode"
    )
    legal_representative: Optional[str] = Field(
        None, max_length=100, description="法定代表人", alias="legalRepresentative"
    )
    enterprise_type_code: Optional[str] = Field(
        None, max_length=50, description="企业类型编码", alias="enterpriseTypeCode"
    )
    payment_terms_days: Optional[int] = Field(None, ge=0, description="付款账期（天）", alias="paymentTermsDays")
    settlement_method_code: Optional[str] = Field(
        None, max_length=50, description="结算方式编码", alias="settlementMethodCode"
    )
    finance_contact_name: Optional[str] = Field(
        None, max_length=100, description="财务联系人", alias="financeContactName"
    )
    finance_contact_phone: Optional[str] = Field(
        None, max_length=30, description="财务联系电话", alias="financeContactPhone"
    )
    finance_contact_email: Optional[str] = Field(
        None, max_length=100, description="财务联系邮箱", alias="financeContactEmail"
    )
    delivery_contact_name: Optional[str] = Field(
        None, max_length=100, description="收货联系人", alias="deliveryContactName"
    )
    delivery_contact_phone: Optional[str] = Field(
        None, max_length=30, description="收货联系电话", alias="deliveryContactPhone"
    )
    delivery_address: Optional[str] = Field(None, description="收货地址", alias="deliveryAddress")

    model_config = ConfigDict(populate_by_name=True)


class CustomerContactItem(BaseModel):
    """客户联系人明细行"""

    contact_person: Optional[str] = Field(None, max_length=100, description="联系人", alias="contactPerson")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    email: Optional[str] = Field(None, max_length=100, description="邮箱")

    model_config = ConfigDict(populate_by_name=True)


class CustomerCreate(PartnerInvoiceAndExtendedMixin):
    """创建客户 Schema（归属仅通过 salesmanId，池状态由服务写入）"""

    code: str = Field(..., max_length=50, description="客户编码")
    name: str = Field(..., max_length=200, description="客户名称")
    short_name: Optional[str] = Field(None, max_length=100, description="简称", alias="shortName")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人", alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    email: Optional[str] = Field(None, max_length=100, description="邮箱")
    address: Optional[str] = Field(None, description="地址")
    category: Optional[str] = Field(None, max_length=50, description="客户分类")
    salesman_id: Optional[int] = Field(None, description="归属业务员ID", alias="salesmanId")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    contacts: Optional[List[CustomerContactItem]] = Field(None, description="联系人明细")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    customer_level_code: Optional[str] = Field(None, max_length=50, description="客户级别字典值", alias="customerLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购量", alias="estimatedAnnualPurchase")
    lead_source_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="leadSourceCode")
    credit_limit: Optional[Decimal] = Field(None, description="信用额度", alias="creditLimit")
    revenue_recognition_override: Optional[str] = Field(
        None,
        max_length=32,
        description="应收确认策略覆盖：空=跟随组织；on_shipment / on_invoice",
        alias="revenueRecognitionOverride",
    )
    is_active: bool = Field(True, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)

    @validator("revenue_recognition_override", pre=True)
    def validate_revenue_recognition_override(cls, v):
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return None
        s = str(v).strip()
        if s not in ("on_shipment", "on_invoice"):
            raise ValueError("revenueRecognitionOverride 必须为 on_shipment、on_invoice 或空")
        return s

    @validator("code")
    def validate_code(cls, v):
        if not v or not v.strip():
            raise ValueError("客户编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("客户名称不能为空")
        return v.strip()


class CustomerBase(PartnerInvoiceAndExtendedMixin):
    """客户响应基础 Schema（含池只读字段）"""

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
    pool_status: Optional[str] = Field("pool", max_length=20, description="客户池状态：pool/owned", alias="poolStatus")
    assigned_at: Optional[datetime] = Field(None, description="最近领取/分配时间", alias="assignedAt")
    last_follow_up_at: Optional[datetime] = Field(None, description="最近跟进时间", alias="lastFollowUpAt")
    recycle_at: Optional[datetime] = Field(None, description="计划回收时间", alias="recycleAt")
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    contacts: Optional[List[CustomerContactItem]] = Field(None, description="联系人明细")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    customer_level_code: Optional[str] = Field(None, max_length=50, description="客户级别字典值", alias="customerLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购量", alias="estimatedAnnualPurchase")
    lead_source_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="leadSourceCode")
    credit_limit: Optional[Decimal] = Field(None, description="信用额度", alias="creditLimit")
    revenue_recognition_override: Optional[str] = Field(
        None,
        max_length=32,
        description="应收确认策略覆盖：空=跟随组织；on_shipment / on_invoice",
        alias="revenueRecognitionOverride",
    )
    is_active: bool = Field(True, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)


class CustomerUpdate(PartnerInvoiceAndExtendedMixin):
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
    contact_title: Optional[str] = Field(None, max_length=100, description="联系人职位", alias="contactTitle")
    contacts: Optional[List[CustomerContactItem]] = Field(None, description="联系人明细")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    customer_level_code: Optional[str] = Field(None, max_length=50, description="客户级别字典值", alias="customerLevelCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购量", alias="estimatedAnnualPurchase")
    lead_source_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="leadSourceCode")
    credit_limit: Optional[Decimal] = Field(None, description="信用额度", alias="creditLimit")
    revenue_recognition_override: Optional[str] = Field(
        None,
        max_length=32,
        description="应收确认策略覆盖",
        alias="revenueRecognitionOverride",
    )
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)

    @validator("revenue_recognition_override", pre=True)
    def validate_revenue_recognition_override_update(cls, v):
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return None
        s = str(v).strip()
        if s not in ("on_shipment", "on_invoice"):
            raise ValueError("revenueRecognitionOverride 必须为 on_shipment、on_invoice 或空")
        return s

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
    created_by_name: Optional[str] = Field(None, description="创建人姓名", alias="createdByName")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名", alias="updatedByName")
    deleted_at: Optional[datetime] = Field(None, description="删除时间", alias="deletedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class CustomerListResponse(BaseModel):
    """客户分页列表"""

    data: List[CustomerResponse]
    total: int

    model_config = ConfigDict(populate_by_name=True)


class SupplierBase(PartnerInvoiceAndExtendedMixin):
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
    contacts: Optional[List[CustomerContactItem]] = Field(None, description="联系人明细")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购额", alias="estimatedAnnualPurchase")
    source_channel_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="sourceChannelCode")
    credit_limit: Optional[Decimal] = Field(None, description="授信额度", alias="creditLimit")
    payable_recognition_override: Optional[str] = Field(
        None,
        max_length=32,
        description="应付确认策略覆盖：空=跟随组织；on_receipt / on_purchase_invoice",
        alias="payableRecognitionOverride",
    )
    is_active: bool = Field(True, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)

    @validator("payable_recognition_override", pre=True)
    def validate_payable_recognition_override(cls, v):
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return None
        s = str(v).strip()
        if s not in ("on_receipt", "on_purchase_invoice"):
            raise ValueError("payableRecognitionOverride 必须为 on_receipt、on_purchase_invoice 或空")
        return s

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


class SupplierUpdate(PartnerInvoiceAndExtendedMixin):
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
    contacts: Optional[List[CustomerContactItem]] = Field(None, description="联系人明细")
    industry_code: Optional[str] = Field(None, max_length=50, description="所属行业字典值", alias="industryCode")
    estimated_annual_purchase: Optional[Decimal] = Field(None, description="预估年采购额", alias="estimatedAnnualPurchase")
    source_channel_code: Optional[str] = Field(None, max_length=50, description="来源渠道字典值", alias="sourceChannelCode")
    credit_limit: Optional[Decimal] = Field(None, description="授信额度", alias="creditLimit")
    payable_recognition_override: Optional[str] = Field(
        None,
        max_length=32,
        description="应付确认策略覆盖",
        alias="payableRecognitionOverride",
    )
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")

    model_config = ConfigDict(populate_by_name=True)

    @validator("payable_recognition_override", pre=True)
    def validate_payable_recognition_override_update(cls, v):
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return None
        s = str(v).strip()
        if s not in ("on_receipt", "on_purchase_invoice"):
            raise ValueError("payableRecognitionOverride 必须为 on_receipt、on_purchase_invoice 或空")
        return s

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
    created_by_name: Optional[str] = Field(None, description="创建人姓名", alias="createdByName")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名", alias="updatedByName")
    deleted_at: Optional[datetime] = Field(None, description="删除时间", alias="deletedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class SupplierListResponse(BaseModel):
    """供应商分页列表"""

    data: List[SupplierResponse]
    total: int

    model_config = ConfigDict(populate_by_name=True)

