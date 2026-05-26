"""
排程场景模型（Scenario Sandbox）
"""

from tortoise import fields
from core.models.base import BaseModel


class SchedulingScenario(BaseModel):
    """排程沙盘场景。"""

    id = fields.IntField(pk=True, description="主键ID")
    name = fields.CharField(max_length=120, description="场景名称")
    description = fields.TextField(null=True, description="场景描述")
    status = fields.CharField(max_length=20, default="draft", description="场景状态（draft/simulated/published）")
    objective = fields.CharField(max_length=40, default="min_makespan", description="优化目标")

    work_order_ids = fields.JSONField(default=list, description="场景工单ID列表")
    constraints = fields.JSONField(default=dict, description="场景约束")
    result_snapshot = fields.JSONField(default=dict, description="排程结果快照")
    metrics = fields.JSONField(default=dict, description="场景指标快照")

    published_at = fields.DatetimeField(null=True, description="发布时间")
    published_by = fields.IntField(null=True, description="发布人ID")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_scheduling_scenarios"
        table_description = "快格轻制造 - 排程场景"
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "objective"),
            ("created_at",),
        ]
