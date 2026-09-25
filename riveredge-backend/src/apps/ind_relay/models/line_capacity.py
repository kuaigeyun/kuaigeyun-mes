from tortoise import fields

from core.models.base import BaseModel


class RelayLineCapacity(BaseModel):
    """产线节拍与日产能（行业表，不污染通用产线主数据）。"""

    class Meta:
        table = "apps_ind_relay_line_capacities"
        table_description = "继电器行业 - 产线节拍产能"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("production_line_id",),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    production_line_id = fields.IntField(description="产线ID")
    production_line_code = fields.CharField(max_length=50, null=True, description="产线编码")
    production_line_name = fields.CharField(max_length=200, null=True, description="产线名称")
    takt_seconds = fields.DecimalField(
        max_digits=12, decimal_places=2, default=0, description="节拍秒/件"
    )
    daily_capacity_qty = fields.DecimalField(
        max_digits=14, decimal_places=2, default=0, description="日产能件数"
    )
    changeover_minutes_default = fields.DecimalField(
        max_digits=10, decimal_places=2, default=0, description="默认换型分钟"
    )
    is_active = fields.BooleanField(default=True, description="是否启用")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)
