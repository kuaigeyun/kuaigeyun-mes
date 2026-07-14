"""
阶段门模板模型

Author: RiverEdge Team
Date: 2026-07-07
"""

from tortoise import fields

from core.models.base import BaseModel
from apps.kuaiplm.constants.rd_project import GateMilestoneRole, RdProjectType


class RdGateTemplate(BaseModel):
    """阶段门模板头"""

    tenant_id = fields.IntField(description="租户ID")
    project_type = fields.CharField(
        max_length=20,
        default=RdProjectType.RD.value,
        description="项目类型 RD | DELIVERY",
    )
    template_code = fields.CharField(max_length=50, description="模板编码")
    template_name = fields.CharField(max_length=200, description="模板名称")
    is_default = fields.BooleanField(default=False, description="是否默认模板")
    is_active = fields.BooleanField(default=True, description="是否启用")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_rd_gate_templates"
        table_description = "快研发 - 阶段门模板"
        unique_together = (("tenant_id", "project_type", "template_code"),)
        indexes = [
            ("tenant_id", "project_type"),
            ("tenant_id", "project_type", "is_default"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RdGateTemplateStage(BaseModel):
    """阶段门模板阶段"""

    tenant_id = fields.IntField(description="租户ID")
    template_id = fields.IntField(description="模板ID")
    gate_key = fields.CharField(max_length=30, description="阶段门标识")
    gate_name = fields.CharField(max_length=100, description="阶段门名称")
    sort_order = fields.IntField(default=0, description="排序")
    milestone_role = fields.CharField(
        max_length=30,
        default=GateMilestoneRole.NONE.value,
        description="里程碑角色 none | spawn_delivery",
    )

    class Meta:
        table = "apps_kuaiplm_rd_gate_template_stages"
        table_description = "快研发 - 阶段门模板阶段"
        unique_together = (("template_id", "gate_key"),)
        indexes = [("tenant_id", "template_id")]


class RdGateTemplateDeliverable(BaseModel):
    """阶段门模板默认交付物"""

    tenant_id = fields.IntField(description="租户ID")
    stage_id = fields.IntField(description="阶段ID")
    name = fields.CharField(max_length=200, description="交付物名称")
    deliverable_type = fields.CharField(max_length=50, null=True, description="交付物类型")
    sort_order = fields.IntField(default=0, description="排序")

    class Meta:
        table = "apps_kuaiplm_rd_gate_template_deliverables"
        table_description = "快研发 - 阶段门模板默认交付物"
        indexes = [("tenant_id", "stage_id")]
