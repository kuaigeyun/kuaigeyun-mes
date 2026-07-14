"""
研发项目 / NPI 模型

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import fields

from core.models.base import BaseModel
from apps.kuaiplm.constants.rd_project import (
    GateMilestoneRole,
    RdDeliverableStatus,
    RdGateStatus,
    RdProjectLinkType,
    RdProjectStatus,
    RdProjectType,
    RdTaskStatus,
)


class RdProject(BaseModel):
    """研发项目"""

    tenant_id = fields.IntField(description="租户ID")
    project_code = fields.CharField(max_length=50, db_index=True, description="项目编码")
    project_name = fields.CharField(max_length=200, description="项目名称")
    description = fields.TextField(null=True, description="项目描述")
    status = fields.CharField(
        max_length=30,
        default=RdProjectStatus.DRAFT.value,
        description="项目状态",
    )
    project_type = fields.CharField(
        max_length=20,
        default=RdProjectType.RD.value,
        description="项目类型 RD | DELIVERY",
    )
    source_project_id = fields.IntField(null=True, description="来源研发项目ID")
    gate_template_id = fields.IntField(null=True, description="阶段门模板ID")
    material_id = fields.IntField(null=True, description="目标物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="目标物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="目标物料名称")
    current_gate_key = fields.CharField(max_length=30, null=True, description="当前阶段门")
    owner_id = fields.IntField(null=True, description="负责人ID")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    priority = fields.CharField(max_length=20, default="normal", description="优先级")
    planned_start_date = fields.DateField(null=True, description="计划开始日期")
    planned_end_date = fields.DateField(null=True, description="计划结束日期")
    actual_start_date = fields.DateField(null=True, description="实际开始日期")
    actual_end_date = fields.DateField(null=True, description="实际结束日期")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaiplm_rd_projects"
        table_description = "快研发 - 研发项目"
        indexes = [
            ("tenant_id",),
            ("project_code",),
            ("status",),
            ("tenant_id", "project_type"),
            ("source_project_id",),
            ("gate_template_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RdProjectGate(BaseModel):
    """NPI 阶段门"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    gate_key = fields.CharField(max_length=30, description="阶段门标识")
    gate_name = fields.CharField(max_length=100, description="阶段门名称")
    sort_order = fields.IntField(default=0, description="排序")
    status = fields.CharField(
        max_length=30,
        default=RdGateStatus.PENDING.value,
        description="阶段门状态",
    )
    planned_date = fields.DateField(null=True, description="计划日期")
    actual_date = fields.DateField(null=True, description="实际日期")
    reviewer_id = fields.IntField(null=True, description="评审人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="评审人姓名")
    review_notes = fields.TextField(null=True, description="评审备注")
    criteria = fields.TextField(null=True, description="通过准则")
    milestone_role = fields.CharField(
        max_length=30,
        default=GateMilestoneRole.NONE.value,
        null=True,
        description="里程碑角色 none | spawn_delivery",
    )

    class Meta:
        table = "apps_kuaiplm_rd_project_gates"
        table_description = "快研发 - NPI 阶段门"
        unique_together = (("tenant_id", "project_id", "gate_key"),)
        indexes = [("tenant_id", "project_id")]


class RdProjectTask(BaseModel):
    """研发项目任务"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    gate_id = fields.IntField(null=True, description="阶段门ID")
    parent_task_id = fields.IntField(null=True, description="父任务ID（仅支持一级子任务）")
    task_name = fields.CharField(max_length=200, description="任务名称")
    description = fields.TextField(null=True, description="任务描述")
    status = fields.CharField(
        max_length=30,
        default=RdTaskStatus.TODO.value,
        description="任务状态",
    )
    assignee_id = fields.IntField(null=True, description="执行人ID")
    assignee_name = fields.CharField(max_length=100, null=True, description="执行人姓名")
    due_date = fields.DateField(null=True, description="截止日期")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    sort_order = fields.IntField(default=0, description="排序")
    priority = fields.CharField(max_length=20, default="normal", description="优先级")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_rd_project_tasks"
        table_description = "快研发 - 项目任务"
        indexes = [("tenant_id", "project_id"), ("parent_task_id",)]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RdProjectDeliverable(BaseModel):
    """研发项目交付物"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    gate_id = fields.IntField(null=True, description="阶段门ID")
    name = fields.CharField(max_length=200, description="交付物名称")
    description = fields.TextField(null=True, description="描述")
    deliverable_type = fields.CharField(max_length=50, null=True, description="交付物类型")
    status = fields.CharField(
        max_length=30,
        default=RdDeliverableStatus.PENDING.value,
        description="状态",
    )
    file_url = fields.CharField(max_length=500, null=True, description="文件URL")
    file_name = fields.CharField(max_length=200, null=True, description="文件名")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    approved_at = fields.DatetimeField(null=True, description="批准时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_rd_project_deliverables"
        table_description = "快研发 - 项目交付物"
        indexes = [("tenant_id", "project_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RdProjectLink(BaseModel):
    """研发项目关联（BOM/工艺/图纸/工单等）"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    link_type = fields.CharField(
        max_length=50,
        default=RdProjectLinkType.OTHER.value,
        description="关联类型",
    )
    target_type = fields.CharField(max_length=50, description="目标类型")
    target_id = fields.IntField(null=True, description="目标ID")
    target_uuid = fields.CharField(max_length=36, null=True, description="目标UUID")
    target_code = fields.CharField(max_length=100, null=True, description="目标编码")
    target_name = fields.CharField(max_length=200, null=True, description="目标名称")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaiplm_rd_project_links"
        table_description = "快研发 - 项目关联"
        indexes = [
            ("tenant_id", "project_id"),
            ("target_type", "target_id"),
        ]
