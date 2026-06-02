"""
工位 SOP 阅读确认记录
"""

from tortoise import fields
from core.models.base import BaseModel


class StationSopAcknowledgment(BaseModel):
    """工位 ESOP 开工前确认"""

    class Meta:
        table = "apps_kuaizhizao_station_sop_acknowledgments"
        table_description = "快格轻制造 - 工位SOP确认"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("operation_id",),
            ("sop_uuid",),
        ]
        unique_together = [("tenant_id", "work_order_id", "operation_id", "sop_uuid", "worker_id")]

    tenant_id = fields.IntField(description="租户ID")
    sop_uuid = fields.CharField(max_length=64, description="SOP UUID")
    work_order_id = fields.IntField(description="工单ID")
    operation_id = fields.IntField(description="工序ID")
    worker_id = fields.IntField(description="操作工ID")
    worker_name = fields.CharField(max_length=100, description="操作工姓名")
    acknowledged_at = fields.DatetimeField(description="确认时间")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
