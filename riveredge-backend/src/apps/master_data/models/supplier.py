"""
供应商模型模块

定义供应商数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Supplier(BaseModel):
    """
    供应商模型
    
    用于管理供应商基础数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 供应商编码（组织内唯一）
        name: 供应商名称
        short_name: 简称
        contact_person: 联系人
        phone: 电话
        email: 邮箱
        address: 地址
        category: 供应商分类
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_suppliers"
        table_description = "基础数据管理 - 供应商"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("category",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="供应商编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="供应商名称")
    short_name = fields.CharField(max_length=100, null=True, description="简称")
    
    # 联系信息（contact_person/phone/email/contact_title 保留为首条联系人快照，供列表与检索）
    contact_person = fields.CharField(max_length=100, null=True, description="联系人")
    phone = fields.CharField(max_length=20, null=True, description="电话")
    email = fields.CharField(max_length=100, null=True, description="邮箱")
    contacts = fields.JSONField(null=True, default=list, description="联系人明细 JSON 数组")
    address = fields.TextField(null=True, description="地址")
    
    # 分类信息
    category = fields.CharField(max_length=50, null=True, description="供应商分类")
    
    # 归属采购员
    buyer_id = fields.IntField(null=True, description="归属采购员ID（关联 User.id）")
    buyer_name = fields.CharField(max_length=100, null=True, description="归属采购员姓名")

    # 扩展业务信息（字典项存 value）
    contact_title = fields.CharField(max_length=100, null=True, description="联系人职位")
    industry_code = fields.CharField(max_length=50, null=True, description="所属行业（数据字典 INDUSTRY_SECTOR）")
    estimated_annual_purchase = fields.DecimalField(
        max_digits=18, decimal_places=2, null=True, description="预估年采购额（本企业向该供应商）"
    )
    source_channel_code = fields.CharField(max_length=50, null=True, description="来源渠道（数据字典 PARTNER_SOURCE_CHANNEL）")
    credit_limit = fields.DecimalField(
        max_digits=18, decimal_places=2, null=True, description="授信额度"
    )

    # 开票资料（收票/票面常用）
    tax_registration_no = fields.CharField(max_length=50, null=True, description="统一社会信用代码/纳税人识别号")
    invoice_title = fields.CharField(max_length=200, null=True, description="发票抬头")
    invoice_address = fields.TextField(null=True, description="开票地址")
    invoice_phone = fields.CharField(max_length=50, null=True, description="开票电话")
    invoice_bank_name = fields.CharField(max_length=200, null=True, description="开票开户银行")
    invoice_bank_account = fields.CharField(max_length=64, null=True, description="开票银行账号")
    invoice_type_code = fields.CharField(max_length=50, null=True, description="发票类型偏好编码")
    taxpayer_type_code = fields.CharField(max_length=50, null=True, description="纳税人类型编码")

    # 商事主体与结算、联系人扩展
    legal_representative = fields.CharField(max_length=100, null=True, description="法定代表人")
    enterprise_type_code = fields.CharField(max_length=50, null=True, description="企业类型编码")
    payment_terms_days = fields.IntField(null=True, description="付款账期（天）")
    settlement_method_code = fields.CharField(max_length=50, null=True, description="结算方式编码")
    finance_contact_name = fields.CharField(max_length=100, null=True, description="财务联系人")
    finance_contact_phone = fields.CharField(max_length=30, null=True, description="财务联系电话")
    finance_contact_email = fields.CharField(max_length=100, null=True, description="财务联系邮箱")
    delivery_contact_name = fields.CharField(max_length=100, null=True, description="收货联系人")
    delivery_contact_phone = fields.CharField(max_length=30, null=True, description="收货联系电话")
    delivery_address = fields.TextField(null=True, description="收货地址")

    # 应付确认策略覆盖：null=跟随组织 finance.payable_recognition
    payable_recognition_override = fields.CharField(
        max_length=32, null=True, description="应付确认覆盖：on_receipt / on_purchase_invoice"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

