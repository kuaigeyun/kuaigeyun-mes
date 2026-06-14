"""
需求计算变更事件模型

用于统一记录订单/设计(BOM)/工艺路线等上游变更，
作为影响分析与重算编排的统一输入。
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandChangeEvent(BaseModel):
    """需求计算变更事件"""

    event_code = fields.CharField(max_length=64, description="事件编码")
    event_type = fields.CharField(max_length=32, description="事件类型(order/design/route/manual)")
    source_type = fields.CharField(max_length=64, description="源单据类型(sales_order/bom/process_route/...)")
    source_id = fields.IntField(description="源单据ID")
    source_code = fields.CharField(max_length=64, null=True, description="源单据编码")
    source_name = fields.CharField(max_length=200, null=True, description="源单据名称")
    changed_fields = fields.JSONField(null=True, description="变更字段列表")
    payload = fields.JSONField(null=True, description="事件附加上下文")
    effective_at = fields.DatetimeField(null=True, description="业务生效时间")
    event_status = fields.CharField(max_length=20, default="pending", description="状态 pending/analyzed/closed/failed")
    trigger_reason = fields.CharField(max_length=200, null=True, description="触发原因")
    requested_by = fields.IntField(null=True, description="触发人ID")
    correlation_id = fields.CharField(max_length=64, null=True, description="关联ID(用于幂等)")

    class Meta:
        table = "apps_kuaizhizao_demand_change_events"
        table_description = "快格轻制造 - 需求计算变更事件"
        indexes = [
            ("tenant_id", "event_type"),
            ("tenant_id", "source_type", "source_id"),
            ("tenant_id", "event_status"),
            ("event_code",),
            ("correlation_id",),
            ("created_at",),
        ]
