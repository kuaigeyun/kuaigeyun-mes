"""
发票模型（销项/进项统一）

从快制造迁移至快财务。提供进项发票（采购）和销项发票（销售）的统一管理。
表名已按 APP 代码重命名为 apps_kuaicaiwu_invoices / apps_kuaicaiwu_invoice_items。

Author: Antigravity
Date: 2026-02-02
Migrated: 2026-03
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
    invoice_code = fields.CharField(max_length=50, db_index=True, description="发票系统编号")  # 租户内未删除唯一，见迁移 463
    invoice_number = fields.CharField(max_length=50, description="发票号码")
    invoice_details_code = fields.CharField(max_length=50, null=True, description="发票代码")

    # 分类
    category = fields.CharField(max_length=20, default="IN", description="发票类别：IN=进项(采购), OUT=销项(销售)")
    invoice_type = fields.CharField(max_length=50, default="VAT_SPECIAL", description="发票类型")

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
    tax_rate = fields.DecimalField(max_digits=6, decimal_places=4, default=0.13, description="税率")

    # 日期
    invoice_date = fields.DateField(description="开票日期")
    received_date = fields.DateField(null=True, description="收票/开具日期")

    # 状态
    status = fields.CharField(max_length=20, default="DRAFT", description="状态")
    verification_date = fields.DateField(null=True, description="认证日期(进项)")

    source_document_code = fields.CharField(max_length=100, null=True, description="来源单据号")
    attachment_uuid = fields.CharField(max_length=36, null=True, description="发票文件ID")
    description = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")

    receivable_id = fields.IntField(null=True, description="关联应收单ID")
    receivable_code = fields.CharField(max_length=50, null=True, description="关联应收单编码")

    void_reason = fields.TextField(null=True, description="作废原因")
    voided_at = fields.DatetimeField(null=True, description="作废时间")
    original_invoice_id = fields.IntField(null=True, description="红字发票对应的蓝字发票ID")
    red_flush_invoice_id = fields.IntField(null=True, description="蓝字发票被红冲后生成的红字发票ID")

    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaicaiwu_invoices"
        table_description = "快财务 - 发票库（销项/进项）"
        indexes = [
            ("tenant_id", "category", "invoice_date"),
            ("invoice_number",),
            ("partner_id",),
            ("tenant_id", "receivable_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]

    def __str__(self):
        return f"{self.invoice_code} - {self.invoice_number}"


class InvoiceItem(BaseModel):
    """发票明细 (InvoiceItem)"""
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

    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaicaiwu_invoice_items"
        table_description = "快财务 - 发票明细"

    class PydanticMeta:
        exclude = ["deleted_at"]

    def __str__(self):
        return f"{self.item_name} - {self.amount}"
