"""好力 GO 财务 — 电子发票、验收单。"""

from tortoise import fields

from apps.haoligo.constants.finance_decimal import (
    FINANCE_UNIT_PRICE_DECIMAL_PLACES,
    FINANCE_UNIT_PRICE_MAX_DIGITS,
)
from apps.haoligo.fields import FinanceUnitPriceDecimalField
from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoFinanceInvoice(HaoligoTenantModel):
    """电子发票（验票）。"""

    class Meta:
        table = "haoligo_finance_invoice"
        table_description = "好力GO - 财务电子发票"
        indexes = [
            ("tenant_id",),
            ("supplier_id",),
            ("invoice_no",),
            ("status",),
        ]

    supplier = fields.ForeignKeyField(
        "models.HaoligoFinanceSupplier",
        related_name="invoices",
        on_delete=fields.RESTRICT,
        description="材料供应商",
    )
    invoice_no = fields.CharField(max_length=64, description="发票号码")
    invoice_code = fields.CharField(max_length=64, null=True, description="发票代码")
    invoice_date = fields.DateField(null=True, description="开票日期")
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="价税合计")
    qr_raw_text = fields.TextField(null=True, description="原始 QR/粘贴文本")
    source_file_uuid = fields.CharField(max_length=36, null=True, description="上传文件 UUID")
    parsed_snapshot = fields.JSONField(null=True, description="解析 JSON 快照")
    status = fields.CharField(max_length=16, default="已登记", description="状态")
    reject_reason = fields.TextField(null=True, description="拒收原因")
    remark = fields.TextField(null=True, description="备注")


class HaoligoFinanceInvoiceLine(HaoligoTenantModel):
    """发票明细行。"""

    class Meta:
        table = "haoligo_finance_invoice_line"
        table_description = "好力GO - 财务发票明细"
        indexes = [("tenant_id",), ("invoice_id",), ("material_code",)]

    invoice = fields.ForeignKeyField(
        "models.HaoligoFinanceInvoice",
        related_name="lines",
        on_delete=fields.CASCADE,
        description="所属发票",
    )
    line_no = fields.IntField(default=1, description="行号")
    material_code = fields.CharField(max_length=64, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    spec = fields.CharField(max_length=200, null=True, description="规格")
    unit = fields.CharField(max_length=32, null=True, description="单位")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="数量")
    invoice_unit_price = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        description="发票单价",
    )
    invoice_unit_price_literal = fields.TextField(
        null=True,
        description="发票单价原文（唯一精度真源，保留录入/OCR 全部小数位）",
    )
    tax_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="税额")
    system_unit_price = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        null=True,
        description="系统单价快照",
    )
    system_unit_price_literal = fields.TextField(
        null=True,
        description="系统单价原文快照（唯一精度真源）",
    )
    price_diff_amount = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        null=True,
        description="单价差异",
    )
    price_diff_ratio = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="差异比例")
    line_status = fields.CharField(max_length=16, default="未登记", description="行核对状态")
    supplier_price_id = fields.IntField(null=True, description="匹配的系统单价行 ID")
    reject_reason = fields.TextField(null=True, description="行拒收原因")


class HaoligoFinanceMaterialAcceptance(HaoligoTenantModel):
    """材料验收单。"""

    class Meta:
        table = "haoligo_finance_material_acceptance"
        table_description = "好力GO - 财务材料验收单"
        unique_together = [("tenant_id", "sheet_no")]
        indexes = [("tenant_id",), ("supplier_id",), ("status",), ("acceptance_date",)]

    sheet_no = fields.CharField(max_length=64, description="验收单号")
    supplier = fields.ForeignKeyField(
        "models.HaoligoFinanceSupplier",
        related_name="material_acceptances",
        on_delete=fields.RESTRICT,
        description="材料供应商",
    )
    acceptance_date = fields.DateField(null=True, description="验收日期")
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="汇总金额")
    status = fields.CharField(max_length=16, default="草稿", description="状态")
    reject_reason = fields.TextField(null=True, description="拒收原因")
    pdf_file_uuid = fields.CharField(max_length=36, null=True, description="PDF 文件 UUID")
    remark = fields.TextField(null=True, description="备注")


class HaoligoFinanceMaterialAcceptanceLine(HaoligoTenantModel):
    """材料验收单明细。"""

    class Meta:
        table = "haoligo_finance_material_acceptance_line"
        table_description = "好力GO - 财务材料验收单明细"
        indexes = [("tenant_id",), ("acceptance_id",), ("material_code",)]

    acceptance = fields.ForeignKeyField(
        "models.HaoligoFinanceMaterialAcceptance",
        related_name="lines",
        on_delete=fields.CASCADE,
        description="所属验收单",
    )
    line_no = fields.IntField(default=1, description="行号")
    material_code = fields.CharField(max_length=64, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    spec = fields.CharField(max_length=200, null=True, description="规格")
    unit = fields.CharField(max_length=32, null=True, description="单位")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="数量")
    unit_price = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        description="单价",
    )
    amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="金额")
    source_invoice_line_ids = fields.JSONField(null=True, description="来源发票明细 ID 列表")


class HaoligoFinanceAcceptanceInvoice(HaoligoTenantModel):
    """验收单与发票 M:N 关联。"""

    class Meta:
        table = "haoligo_finance_acceptance_invoice"
        table_description = "好力GO - 财务验收单发票关联"
        unique_together = [("tenant_id", "acceptance_id", "invoice_id")]
        indexes = [("tenant_id",), ("acceptance_id",), ("invoice_id",)]

    acceptance = fields.ForeignKeyField(
        "models.HaoligoFinanceMaterialAcceptance",
        related_name="invoice_links",
        on_delete=fields.CASCADE,
        description="验收单",
    )
    invoice = fields.ForeignKeyField(
        "models.HaoligoFinanceInvoice",
        related_name="acceptance_links",
        on_delete=fields.RESTRICT,
        description="发票",
    )
