"""好力 GO 财务 — 材料供应商与单价清单。"""

from tortoise import fields

from apps.haoligo.constants.finance_decimal import (
    FINANCE_UNIT_PRICE_DECIMAL_PLACES,
    FINANCE_UNIT_PRICE_MAX_DIGITS,
)
from apps.haoligo.fields import FinanceUnitPriceDecimalField
from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoFinanceSupplier(HaoligoTenantModel):
    """材料供应商（独立于 master-data Supplier）。"""

    class Meta:
        table = "haoligo_finance_supplier"
        table_description = "好力GO - 财务材料供应商"
        unique_together = [("tenant_id", "supplier_code")]
        indexes = [("tenant_id",), ("supplier_code",), ("is_active",)]

    supplier_code = fields.CharField(max_length=64, description="供应商代号")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")
    tax_no = fields.CharField(max_length=64, null=True, description="税号")
    contact_name = fields.CharField(max_length=100, null=True, description="联系人")
    contact_phone = fields.CharField(max_length=64, null=True, description="联系电话")
    payment_terms_days = fields.IntField(default=0, description="账期天数")
    settlement_method = fields.CharField(max_length=64, null=True, description="结算方式")
    is_active = fields.BooleanField(default=True, description="是否启用")
    remark = fields.TextField(null=True, description="备注")


class HaoligoFinanceSupplierPrice(HaoligoTenantModel):
    """材料供应商物料单价（有效期 + 关旧开新）。"""

    class Meta:
        table = "haoligo_finance_supplier_price"
        table_description = "好力GO - 财务材料供应商单价"
        indexes = [
            ("tenant_id",),
            ("supplier_id",),
            ("material_code",),
            ("supplier_id", "material_code"),
            ("effective_from", "effective_to"),
            ("is_active",),
        ]

    supplier = fields.ForeignKeyField(
        "models.HaoligoFinanceSupplier",
        related_name="prices",
        on_delete=fields.RESTRICT,
        description="材料供应商",
    )
    material_code = fields.CharField(max_length=64, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    spec = fields.CharField(max_length=200, null=True, description="规格")
    unit = fields.CharField(max_length=32, null=True, description="单位")
    unit_price = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        description="单价",
    )
    unit_price_literal = fields.TextField(
        null=True,
        description="单价原文字符串（唯一精度真源，与导入/录入完全一致）",
    )
    price_type = fields.CharField(max_length=16, description="价类：含税/不含税")
    tax_rate = fields.DecimalField(max_digits=8, decimal_places=4, null=True, description="税率（%）")
    material_id = fields.IntField(null=True, description="可选关联 master-data Material ID")
    effective_from = fields.DateField(null=True, description="生效起始日")
    effective_to = fields.DateField(null=True, description="生效截止日")
    is_active = fields.BooleanField(default=True, description="是否当前有效")
    remark = fields.TextField(null=True, description="备注")


class HaoligoFinancePriceChangeLog(HaoligoTenantModel):
    """单价变更留痕。"""

    class Meta:
        table = "haoligo_finance_price_change_log"
        table_description = "好力GO - 财务单价变更日志"
        indexes = [("tenant_id",), ("supplier_id",), ("material_code",), ("created_at",)]

    supplier_id = fields.IntField(description="材料供应商 ID")
    supplier_price_id = fields.IntField(null=True, description="新价格行 ID")
    previous_price_id = fields.IntField(null=True, description="被关闭的旧价格行 ID")
    material_code = fields.CharField(max_length=64, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    old_unit_price = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        null=True,
        description="旧单价",
    )
    new_unit_price = FinanceUnitPriceDecimalField(
        max_digits=FINANCE_UNIT_PRICE_MAX_DIGITS,
        decimal_places=FINANCE_UNIT_PRICE_DECIMAL_PLACES,
        description="新单价",
    )
    change_source = fields.CharField(max_length=32, description="变更来源")
    operator_user_id = fields.IntField(null=True, description="操作人用户 ID")
    operator_user_name = fields.CharField(max_length=100, null=True, description="操作人姓名")
    related_acceptance_line_id = fields.IntField(null=True, description="关联验收单行（预留）")
    remark = fields.TextField(null=True, description="备注")
