"""试流单（R-08）：元件 / 结构 / 整机试流。"""

from tortoise import fields

from core.models.base import BaseModel

# business_type
TRIAL_FLOW_COMPONENT = "component"
TRIAL_FLOW_STRUCTURE = "structure"
TRIAL_FLOW_COMPLETE = "complete"
TRIAL_FLOW_TYPES = frozenset(
    {TRIAL_FLOW_COMPONENT, TRIAL_FLOW_STRUCTURE, TRIAL_FLOW_COMPLETE}
)

# 通用默认工序节点（部门维度）；租户可后续用模板扩展，禁止客户硬编码节点名进代码分支
DEFAULT_STEPS_BY_TYPE: dict[str, list[tuple[str, str, str]]] = {
    # (step_key, step_name, dept_code)
    TRIAL_FLOW_COMPONENT: [
        ("iqc", "来料确认", "iqc"),
        ("rd", "研发试流", "rd"),
        ("pe", "工艺确认", "pe"),
        ("qa", "质量结论", "qa"),
    ],
    TRIAL_FLOW_STRUCTURE: [
        ("rd", "结构试装", "rd"),
        ("pe", "工艺确认", "pe"),
        ("qa", "质量结论", "qa"),
    ],
    TRIAL_FLOW_COMPLETE: [
        ("plan", "试产计划", "plan"),
        ("prod", "制造执行", "prod"),
        ("pqc", "过程检验", "pqc"),
        ("oqc", "最终检验", "oqc"),
        ("qa", "质量结论", "qa"),
    ],
}


class TrialFlow(BaseModel):
    """试流单头。"""

    class Meta:
        table = "apps_kuaiplm_trial_flows"
        table_description = "快研发 - 试流单"
        unique_together = [("tenant_id", "trial_code")]
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "business_type"),
            ("tenant_id", "status"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    trial_code = fields.CharField(max_length=50, description="试流单号")
    project_id = fields.IntField(description="研发项目ID")
    project_code = fields.CharField(max_length=50, description="项目代号快照")
    project_name = fields.CharField(max_length=200, description="项目名称快照")
    business_type = fields.CharField(
        max_length=20,
        description="component/structure/complete",
    )
    title = fields.CharField(max_length=200, description="标题")
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="draft/pending/approved/in_progress/concluded/closed",
    )
    current_step_key = fields.CharField(
        max_length=50, null=True, description="当前待填工序 key"
    )
    conclusion = fields.CharField(
        max_length=20, null=True, description="pass/fail/conditional"
    )
    conclusion_summary = fields.TextField(null=True, description="结论说明")
    remarks = fields.TextField(null=True, description="备注")
    extension_payload = fields.JSONField(null=True, description="行业扩展载荷（profile 头字段）")
    submitted_at = fields.DatetimeField(null=True)
    approved_at = fields.DatetimeField(null=True)
    concluded_at = fields.DatetimeField(null=True)
    closed_at = fields.DatetimeField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class TrialFlowMaterialLine(BaseModel):
    """试流物料行。"""

    class Meta:
        table = "apps_kuaiplm_trial_flow_materials"
        table_description = "快研发 - 试流物料行"
        indexes = [("tenant_id", "trial_flow_id"), ("uuid",)]

    id = fields.IntField(pk=True)
    trial_flow_id = fields.IntField(description="试流单ID")
    line_no = fields.IntField(default=1, description="行号")
    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=80, description="物料编码快照")
    material_name = fields.CharField(max_length=200, description="物料名称快照")
    qty = fields.DecimalField(max_digits=18, decimal_places=4, null=True)
    unit = fields.CharField(max_length=20, null=True)
    remarks = fields.CharField(max_length=500, null=True)
    deleted_at = fields.DatetimeField(null=True)


class TrialFlowStepResult(BaseModel):
    """试流工序/部门结果行。"""

    class Meta:
        table = "apps_kuaiplm_trial_flow_steps"
        table_description = "快研发 - 试流工序结果"
        indexes = [("tenant_id", "trial_flow_id"), ("uuid",)]
        unique_together = [("tenant_id", "trial_flow_id", "step_key")]

    id = fields.IntField(pk=True)
    trial_flow_id = fields.IntField(description="试流单ID")
    step_key = fields.CharField(max_length=50)
    step_name = fields.CharField(max_length=100)
    dept_code = fields.CharField(max_length=50, description="责任部门码")
    sort_order = fields.IntField(default=0)
    status = fields.CharField(
        max_length=20, default="pending", description="pending/done/skipped"
    )
    result = fields.CharField(
        max_length=20, null=True, description="pass/fail/na"
    )
    result_notes = fields.TextField(null=True)
    step_description = fields.TextField(null=True, description="工序描述")
    defect_rate = fields.DecimalField(
        max_digits=8, decimal_places=4, null=True, description="不良率 0-100"
    )
    filled_by = fields.IntField(null=True)
    filled_by_name = fields.CharField(max_length=100, null=True)
    filled_at = fields.DatetimeField(null=True)
    deleted_at = fields.DatetimeField(null=True)
