"""
工位交接班确认记录
"""

from tortoise import fields

from core.models.base import BaseModel


class StationShiftHandover(BaseModel):
    """工位交接班留痕"""

    class Meta:
        table = "apps_kuaizhizao_station_shift_handovers"
        table_description = "快格轻制造 - 工位交接班"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("workstation_id",),
            ("created_at",),
        ]

    tenant_id = fields.IntField(description="租户ID")
    workstation_id = fields.IntField(null=True, description="工位ID")
    workstation_name = fields.CharField(max_length=100, null=True, description="工位名称")
    operator_id = fields.IntField(description="交班人ID")
    operator_name = fields.CharField(max_length=100, description="交班人姓名")
    shift_start = fields.DatetimeField(description="班次开始时间")
    shift_end = fields.DatetimeField(description="班次结束时间")
    planned_qty = fields.DecimalField(max_digits=18, decimal_places=4, default=0)
    completed_qty = fields.DecimalField(max_digits=18, decimal_places=4, default=0)
    unqualified_qty = fields.DecimalField(max_digits=18, decimal_places=4, default=0)
    downtime_minutes = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    andon_count = fields.IntField(default=0)
    summary_json = fields.JSONField(null=True, description="摘要扩展")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
