"""
需求计算重算历史模型

记录每次需求计算重算的触发、操作人、结果及关联快照。

Author: Auto
Date: 2026-02-22
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandComputationRecalcHistory(BaseModel):
    """
    需求计算重算历史

    每次执行 recompute_computation 写一条记录。
    """
    computation_id = fields.IntField(description="需求计算ID")
    recalc_at = fields.DatetimeField(description="重算时间")
    trigger = fields.CharField(max_length=64, null=True, description="触发（demand_updated / manual）")
    operator_id = fields.IntField(null=True, description="操作人ID")
    result = fields.CharField(max_length=20, description="结果（success / failed）")
    snapshot_id = fields.IntField(null=True, description="关联需求计算快照ID")
    message = fields.TextField(null=True, description="错误或摘要")

    class Meta:
        table = "apps_kuaizhizao_demand_computation_recalc_history"
        table_description = "快格轻制造 - 需求计算重算历史"
        indexes = [
            ("tenant_id", "computation_id"),
            ("recalc_at",),
        ]
