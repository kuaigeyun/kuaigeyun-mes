"""月结定价单行表"""

from tortoise import fields

from core.models.base import BaseModel


class PriceSettlementLine(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    batch: fields.ForeignKeyRelation["PriceSettlementBatch"] = fields.ForeignKeyField(
        "models.PriceSettlementBatch",
        related_name="lines",
        description="定价单",
    )
    source_order_id = fields.IntField(description="来源订单ID")
    source_order_code = fields.CharField(max_length=50, description="来源订单编码")
    source_line_id = fields.IntField(description="来源订单行ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    settled_quantity = fields.DecimalField(max_digits=12, decimal_places=4, default=0, description="已交付/收货数量")
    before_unit_price = fields.DecimalField(max_digits=12, decimal_places=4, default=0, description="定价前单价")
    after_unit_price = fields.DecimalField(max_digits=12, decimal_places=4, default=0, description="定价后单价")
    delta_amount = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="差额金额")
    finance_adjustment_id = fields.IntField(null=True, description="财务调整单ID")
    finance_adjustment_type = fields.CharField(max_length=20, null=True, description="receivable|payable")

    class Meta:
        table = "apps_kuaicaiwu_price_settlement_lines"
        table_description = "轻管理会计 - 月结定价单行"
        unique_together = (("batch_id", "source_line_id"),)
        indexes = [
            ("tenant_id", "source_line_id"),
        ]
