"""原料行情：手输品种按业务日的行情价，不绑定物料。"""

from tortoise import fields

from core.models.base import BaseModel


class MaterialMarketPrice(BaseModel):
    """原料行情（tenant + 品种编码 + 行情日唯一）。"""

    class Meta:
        table = "apps_master_data_material_market_prices"
        table_description = "基础数据 - 原料行情"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("price_date",),
        ]

    id = fields.IntField(pk=True, description="行情ID")
    code = fields.CharField(max_length=50, description="行情品种编码（手输）")
    name = fields.CharField(max_length=100, description="行情品种名称（手输）")
    price_date = fields.DateField(description="行情日（站点日历日）")
    unit_price = fields.DecimalField(max_digits=18, decimal_places=6, description="行情单价")
    price_type = fields.CharField(
        max_length=20,
        default="tax_inclusive",
        description="价类 tax_inclusive / tax_exclusive",
    )
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")
