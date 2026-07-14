"""
滚动计划模型

日粒度派工计划头/行，与 ProductionPlan（MRP 周级）区分。
"""

from tortoise import fields
from core.models.base import BaseModel


class RollingSchedulePlan(BaseModel):
    """滚动计划头（单日派工单据）。"""

    tenant_id = fields.IntField(description="租户ID")
    plan_code = fields.CharField(max_length=50, description="计划编码（RSP…）")
    plan_date = fields.DateField(description="目标工作日")

    status = fields.CharField(
        max_length=20,
        default="draft",
        description="状态：draft / published / closed",
    )
    prev_plan_date = fields.DateField(null=True, description="关联上一工作日（关账来源日）")
    closed_at = fields.DatetimeField(null=True, description="关账时间")
    close_summary = fields.JSONField(null=True, description="关账统计快照")

    published_at = fields.DatetimeField(null=True, description="发布时间")
    published_by = fields.IntField(null=True, description="发布人ID")

    capacity_advisory = fields.JSONField(null=True, description="粗产能提示快照")
    notes = fields.TextField(null=True, description="备注")

    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_rolling_schedule_plans"
        table_description = "快格轻制造 - 滚动计划"
        indexes = [
            ("tenant_id", "plan_date"),
            ("tenant_id", "status"),
            ("plan_code",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RollingSchedulePlanLine(BaseModel):
    """滚动计划行（工单级顺序）。"""

    tenant_id = fields.IntField(description="租户ID")
    plan_id = fields.IntField(description="计划头ID")
    work_order_id = fields.IntField(description="工单ID")
    sequence = fields.IntField(default=0, description="排序序号（越小越优先）")

    planned_quantity = fields.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        description="计划数量（支持部分结转）",
    )
    source_type = fields.CharField(
        max_length=30,
        default="manual",
        description="来源：carry_forward / backlog / already_scheduled / manual",
    )
    readiness_rate_snapshot = fields.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        description="纳入计划时齐套率快照",
    )
    remarks = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_rolling_schedule_plan_lines"
        table_description = "快格轻制造 - 滚动计划行"
        indexes = [
            ("tenant_id", "plan_id"),
            ("plan_id", "sequence"),
            ("work_order_id",),
        ]
