"""
需求重算任务模型

将变更事件分析结果编排为可执行任务，支持净变更与全量重算两种模式。
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandReplanTask(BaseModel):
    """需求重算任务"""

    event_id = fields.IntField(description="关联事件ID")
    task_code = fields.CharField(max_length=64, description="任务编码")
    mode = fields.CharField(max_length=20, default="net_change", description="重算模式 net_change/full_regen/what_if")
    status = fields.CharField(max_length=20, default="pending", description="任务状态 pending/running/completed/failed/cancelled")
    priority = fields.IntField(default=5, description="优先级，数值越小优先级越高")
    risk_level = fields.CharField(max_length=20, default="low", description="风险级别 low/medium/high")
    approval_status = fields.CharField(max_length=20, default="not_required", description="审批状态 not_required/pending/approved/rejected")
    approval_comment = fields.TextField(null=True, description="审批意见")
    auto_apply = fields.BooleanField(default=False, description="是否自动应用")
    threshold_exceeded = fields.BooleanField(default=False, description="是否触发阈值升级")
    task_scope = fields.JSONField(null=True, description="任务范围（需求/计算/物料等）")
    impact_metrics = fields.JSONField(null=True, description="影响规模指标")
    result_summary = fields.JSONField(null=True, description="执行结果摘要")
    started_at = fields.DatetimeField(null=True, description="开始时间")
    finished_at = fields.DatetimeField(null=True, description="结束时间")
    operator_id = fields.IntField(null=True, description="执行人")
    approved_by = fields.IntField(null=True, description="审批人")
    approved_at = fields.DatetimeField(null=True, description="审批时间")
    error_message = fields.TextField(null=True, description="失败原因")

    class Meta:
        table = "apps_kuaizhizao_demand_replan_tasks"
        table_description = "快格轻制造 - 需求重算任务"
        indexes = [
            ("tenant_id", "event_id"),
            ("tenant_id", "mode"),
            ("tenant_id", "status"),
            ("tenant_id", "approval_status"),
            ("task_code",),
            ("created_at",),
        ]
