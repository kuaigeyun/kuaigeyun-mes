"""
工位终端安灯呼叫记录
"""

from tortoise import fields
from core.models.base import BaseModel


class StationAndonCall(BaseModel):
    """工位安灯/求助呼叫"""

    class Meta:
        table = "apps_kuaizhizao_station_andon_calls"
        table_description = "快格轻制造 - 工位安灯呼叫"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("status",),
            ("workstation_id",),
            ("work_order_id",),
            ("created_at",),
        ]

    tenant_id = fields.IntField(description="租户ID")
    call_type = fields.CharField(max_length=32, description="呼叫类型 quality/material/equipment/supervisor")
    status = fields.CharField(max_length=20, default="open", description="open/acknowledged/closed")
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")
    operation_id = fields.IntField(null=True, description="工序ID")
    workstation_id = fields.IntField(null=True, description="工位ID")
    workstation_name = fields.CharField(max_length=100, null=True, description="工位名称")
    caller_id = fields.IntField(description="发起人ID")
    caller_name = fields.CharField(max_length=100, description="发起人姓名")
    remarks = fields.TextField(null=True, description="备注")
    acknowledged_at = fields.DatetimeField(null=True, description="响应时间")
    acknowledged_by = fields.IntField(null=True, description="响应人ID")
    acknowledged_by_name = fields.CharField(max_length=100, null=True, description="响应人姓名")
    closed_at = fields.DatetimeField(null=True, description="关闭时间")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
