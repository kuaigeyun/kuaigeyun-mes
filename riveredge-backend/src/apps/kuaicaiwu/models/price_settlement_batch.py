"""月结定价单头表"""

from tortoise import fields

from core.models.base import BaseModel


class PriceSettlementBatch(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    batch_code = fields.CharField(max_length=50, description="定价单编码")
    period = fields.CharField(max_length=7, description="对账期间 YYYY-MM")
    side = fields.CharField(max_length=20, description="sales|purchase")
    partner_id = fields.IntField(description="客商ID")
    partner_name = fields.CharField(max_length=200, description="客商名称")
    status = fields.CharField(max_length=20, default="draft", description="状态")
    price_source = fields.CharField(max_length=30, default="manual", description="取价来源")
    total_delta_amount = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="差额合计")
    notes = fields.TextField(null=True, description="备注")
    applied_at = fields.DatetimeField(null=True, description="生效时间")
    applied_by = fields.IntField(null=True, description="生效人ID")
    applied_by_name = fields.CharField(max_length=100, null=True, description="生效人姓名")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    lines: fields.ReverseRelation["PriceSettlementLine"]

    class Meta:
        table = "apps_kuaicaiwu_price_settlement_batches"
        table_description = "轻管理会计 - 月结定价单"
        indexes = [
            ("tenant_id", "period", "side"),
            ("tenant_id", "partner_id", "side"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
