"""
需求计算影响记录模型

用于保存单条变更事件的影响分析结果，
将事件与需求/需求计算/生产计划等对象建立可追溯关系。
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandImpactRecord(BaseModel):
    """需求计算影响记录"""

    event_id = fields.IntField(description="变更事件ID")
    impact_type = fields.CharField(max_length=32, description="影响对象类型(demand/computation/plan/material)")
    impact_id = fields.IntField(description="影响对象ID")
    impact_code = fields.CharField(max_length=64, null=True, description="影响对象编码")
    impact_scope = fields.CharField(max_length=32, default="direct", description="影响范围 direct/transitive")
    impact_reason = fields.CharField(max_length=200, description="影响原因")
    impact_payload = fields.JSONField(null=True, description="影响分析附加数据")
    risk_level = fields.CharField(max_length=20, default="low", description="风险级别 low/medium/high")
    needs_approval = fields.BooleanField(default=False, description="是否需要审批")
    frozen_horizon_hit = fields.BooleanField(default=False, description="是否命中冻结期")

    class Meta:
        table = "apps_kuaizhizao_demand_impact_records"
        table_description = "快格轻制造 - 需求计算影响记录"
        indexes = [
            ("tenant_id", "event_id"),
            ("tenant_id", "impact_type", "impact_id"),
            ("tenant_id", "risk_level"),
            ("created_at",),
        ]
