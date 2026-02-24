"""
需求重算历史模型

记录每次需求重算的触发原因、时间、结果等，用于审计与「重算过程」展示。

Author: Auto
Date: 2026-02-22
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandRecalcHistory(BaseModel):
    """
    需求重算历史

    每次需求重算（无论自动或手动）写一条记录。
    """
    demand_id = fields.IntField(description="需求ID")
    recalc_at = fields.DatetimeField(description="重算时间")
    trigger_type = fields.CharField(max_length=32, description="触发类型（upstream_change / manual）")
    source_type = fields.CharField(max_length=50, null=True, description="上游类型（sales_order / sales_forecast）")
    source_id = fields.IntField(null=True, description="上游单据ID")
    trigger_reason = fields.CharField(max_length=200, null=True, description="触发原因描述")
    snapshot_id = fields.IntField(null=True, description="关联需求快照ID")
    operator_id = fields.IntField(null=True, description="操作人ID")
    result = fields.CharField(max_length=20, description="结果（success / failed）")
    message = fields.TextField(null=True, description="简要错误或变更摘要")

    class Meta:
        table = "apps_kuaizhizao_demand_recalc_history"
        table_description = "快格轻制造 - 需求重算历史"
        indexes = [
            ("tenant_id", "demand_id"),
            ("recalc_at",),
        ]
