"""
工位工序停机/暂停记录
"""

from tortoise import fields
from core.models.base import BaseModel


class StationOperationDowntime(BaseModel):
    """工序暂停/停机记录（用于 OEE 与异常分析）"""

    class Meta:
        table = "apps_kuaizhizao_station_operation_downtimes"
        table_description = "快格轻制造 - 工位工序停机"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("operation_id",),
            ("ended_at",),
        ]

    tenant_id = fields.IntField(description="租户ID")
    work_order_id = fields.IntField(description="工单ID")
    operation_id = fields.IntField(description="工序ID")
    reason_code = fields.CharField(max_length=64, description="停机原因码")
    reason_label = fields.CharField(max_length=100, null=True, description="停机原因描述")
    started_at = fields.DatetimeField(description="开始时间")
    ended_at = fields.DatetimeField(null=True, description="结束时间（空表示仍在暂停）")
    operator_id = fields.IntField(description="操作人ID")
    operator_name = fields.CharField(max_length=100, description="操作人姓名")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
