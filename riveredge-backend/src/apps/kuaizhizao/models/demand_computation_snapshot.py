"""
需求计算快照模型

在需求计算重算前保存 DemandComputation 汇总与 DemandComputationItem 明细的 JSON 快照。

Author: Auto
Date: 2026-02-22
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandComputationSnapshot(BaseModel):
    """
    需求计算快照

    在 recompute_computation 执行前写入当前计算汇总与明细的 JSON。
    """
    computation_id = fields.IntField(description="需求计算ID")
    snapshot_at = fields.DatetimeField(description="快照时间")
    trigger = fields.CharField(max_length=64, null=True, description="触发原因（demand_updated / manual）")
    computation_summary_snapshot = fields.JSONField(null=True, description="computation_summary JSON")
    items_snapshot = fields.JSONField(null=True, description="DemandComputationItem 列表 JSON")

    class Meta:
        table = "apps_kuaizhizao_demand_computation_snapshots"
        table_description = "快格轻制造 - 需求计算快照"
        indexes = [
            ("tenant_id", "computation_id"),
            ("snapshot_at",),
        ]
