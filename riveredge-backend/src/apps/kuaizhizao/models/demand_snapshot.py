"""
需求快照模型

在需求重算前保存 Demand + DemandItem 的完整快照，用于追溯与对比。

Author: Auto
Date: 2026-02-22
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandSnapshot(BaseModel):
    """
    需求快照

    在需求因上游变动或手动触发重算前，将当前需求主表与明细序列化为 JSON 保存。
    """
    demand_id = fields.IntField(description="需求ID")
    snapshot_type = fields.CharField(max_length=32, default="before_recalc", description="快照类型（如 before_recalc）")
    snapshot_at = fields.DatetimeField(description="快照时间")
    demand_snapshot = fields.JSONField(description="需求主表关键字段 JSON")
    demand_items_snapshot = fields.JSONField(description="需求明细列表 JSON")
    trigger_reason = fields.CharField(max_length=200, null=True, description="触发原因（如 upstream_sales_order_updated）")

    class Meta:
        table = "apps_kuaizhizao_demand_snapshots"
        table_description = "快格轻制造 - 需求快照"
        indexes = [
            ("tenant_id", "demand_id"),
            ("snapshot_at",),
        ]
