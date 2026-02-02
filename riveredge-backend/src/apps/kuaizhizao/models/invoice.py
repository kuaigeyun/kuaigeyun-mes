"""
发票模型

提供进项发票（采购）和销项发票（销售）的统一管理。
支持增值税专用发票、普通发票等多种类型。

Author: Antigravity
Date: 2026-02-02
"""

from tortoise import fields
from core.models.base import BaseModel


class Invoice(BaseModel):
    """
    发票管理 (Invoice)
    
    用于记录企业的进项发票和销项发票。
    """
    tenant_id = fields.IntField(description="租户ID")
    
    # 基础信息
    invoice_code = fields.CharField(max_length=50, description="发票系统编号", unique=True)
    invoice_number = fields.CharField(max_length=50, description="发票号码")  # 实际发票上的号码
    invoice_details_code = fields.CharField(max_length=50, null=True, description="发票代码") # 实际发票上的代码
    
    # 分类
    category = fields.CharField(max_length=20, default="IN", description="发票类别：IN=进项(采购), OUT=销项(销售)")
    invoice_type = fields.CharField(max_length=50, default="VAT_SPECIAL", description="发票类型：VAT_SPECIAL=专票, VAT_NORMAL=普票, ELECTRONIC=电子发票")
    
    # 往来单位
    partner_id = fields.IntField(description="往来单位ID (供应商ID 或 客户ID)")
    partner_name = fields.CharField(max_length=200, description="往来单位名称")
    partner_tax_no = fields.CharField(max_length=50, null=True, description="往来单位税号")
    partner_bank_info = fields.CharField(max_length=200, null=True, description="往来单位开户行及账号")
    partner_address_phone = fields.CharField(max_length=200, null=True, description="往来单位地址及电话")

    # 金额信息
    amount_excluding_tax = fields.DecimalField(max_digits=14, decimal_places=2, description="不含税金额")
    tax_amount = fields.DecimalField(max_digits=14, decimal_places=2, description="税额")
    total_amount = fields.DecimalField(max_digits=14, decimal_places=2, description="价税合计")
    tax_rate = fields.DecimalField(max_digits=6, decimal_places=4, default=0.13, description="税率 (如 0.13)")
    
    # 日期
    invoice_date = fields.DateField(description="开票日期")
    received_date = fields.DateField(null=True, description="收票/开具日期")
    
    # 状态
    status = fields.CharField(max_length=20, default="DRAFT", description="状态：DRAFT=草稿, CONFIRMED=已确认, VERIFIED=已认证(仅进项), CANCELLED=已作废")
    verification_date = fields.DateField(null=True, description="认证日期(进项)")
    
    # 关联单据 (可以是多对多，这里先简化处理，或者通过中间表关联)
    # 简单场景下，一张发票可能对应一个主要的业务单据号
    source_document_code = fields.CharField(max_length=100, null=True, description="来源单据号 (如 PO123, SO456)")
    
    # 附件
    attachment_uuid = fields.CharField(max_length=36, null=True, description="发票文件ID")
    
    description = fields.TextField(null=True, description="备注")

    # 审计
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")

    class Meta:
        table = "apps_kuaizhizao_invoices"
        table_description = "快格轻制造 - 发票库"
        indexes = [
            ("tenant_id", "category", "invoice_date"),
            ("invoice_number",),
            ("partner_id",),
        ]

    def __str__(self):
        return f"{self.invoice_code} - {self.invoice_number}"


class InvoiceItem(BaseModel):
    """
    发票明细 (InvoiceItem)
    """
    tenant_id = fields.IntField(description="租户ID")
    invoice = fields.ForeignKeyField("models.Invoice", related_name="items", on_delete=fields.CASCADE)
    
    item_name = fields.CharField(max_length=200, description="货物或应税劳务名称")
    spec_model = fields.CharField(max_length=100, null=True, description="规格型号")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    quantity = fields.DecimalField(max_digits=12, decimal_places=4, null=True, description="数量")
    unit_price = fields.DecimalField(max_digits=12, decimal_places=4, null=True, description="单价(不含税)")
    amount = fields.DecimalField(max_digits=14, decimal_places=2, description="金额(不含税)")
    tax_rate = fields.DecimalField(max_digits=6, decimal_places=4, description="税率")
    tax_amount = fields.DecimalField(max_digits=14, decimal_places=2, description="税额")
    
    class Meta:
        table = "apps_kuaizhizao_invoice_items"
        table_description = "快格轻制造 - 发票明细"

    def __str__(self):
        return f"{self.item_name} - {self.amount}"
