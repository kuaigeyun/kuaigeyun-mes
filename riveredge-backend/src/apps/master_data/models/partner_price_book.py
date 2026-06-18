"""
伙伴价格本模型模块

平铺式：客户/供应商 + 内部物料 + 单价 + 有效期。
伙伴料号/品名由 MaterialCodeAlias 富化，不在本表存储。
"""

from tortoise import fields
from core.models.base import BaseModel


class PartnerPriceBook(BaseModel):
    """客户/供应商价格本"""

    class Meta:
        table = "apps_master_data_partner_price_books"
        table_description = "基础数据管理 - 客户供应商价格本"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("partner_type", "partner_id"),
            ("material_id",),
            ("partner_type", "partner_id", "material_id"),
            ("effective_from", "effective_to"),
            ("is_active",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    partner_type = fields.CharField(max_length=20, description="伙伴类型：customer / supplier")
    partner_id = fields.IntField(description="客户或供应商 ID")
    material = fields.ForeignKeyField(
        "models.Material",
        related_name="partner_price_books",
        description="内部物料",
    )
    unit_price = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="标准价（统一价）")
    price_type = fields.CharField(
        max_length=20,
        default="tax_inclusive",
        description="价类：tax_inclusive 含税 / tax_exclusive 不含税",
    )
    variant_prices = fields.JSONField(
        null=True,
        description='属性 SKU 单价列表 JSON：[{"variant_attributes": {...}, "unit_price": 9.5}]',
    )
    currency_code = fields.CharField(max_length=10, null=True, description="币种")
    tax_rate = fields.DecimalField(max_digits=8, decimal_places=4, null=True, description="税率（百分比）")
    unit = fields.CharField(max_length=20, null=True, description="计价单位")
    effective_from = fields.DateField(null=True, description="生效起始日（空=不限）")
    effective_to = fields.DateField(null=True, description="生效截止日（空=不限）")
    remark = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.partner_type}:{self.partner_id} material={self.material_id} price={self.unit_price}"
