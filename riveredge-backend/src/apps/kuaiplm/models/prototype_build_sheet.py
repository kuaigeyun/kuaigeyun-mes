"""样机制作书（R-01 / 研发项目 §2.15）

项目发起 → 电子/结构并行填写要求（文字/图片/附件）→ 审核下发制造样机组 → 制造/质量会签意见。
"""

from tortoise import fields

from core.models.base import BaseModel

ROUND_HANDBOARD = "handboard"
ROUND_T1 = "t1"
ROUND_T2 = "t2"
ROUND_T3 = "t3"
PROTOTYPE_BUILD_ROUNDS = frozenset({ROUND_HANDBOARD, ROUND_T1, ROUND_T2, ROUND_T3})


class PrototypeBuildSheet(BaseModel):
    """样机制作书。"""

    class Meta:
        table = "apps_kuaiplm_prototype_build_sheets"
        table_description = "快研发 - 样机制作书"
        unique_together = [("tenant_id", "sheet_code")]
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "status"),
            ("tenant_id", "round_key"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    sheet_code = fields.CharField(max_length=50, description="样机制作书单号")
    project_id = fields.IntField(description="研发项目ID")
    project_code = fields.CharField(max_length=50, description="项目代号快照")
    project_name = fields.CharField(max_length=200, description="项目名称快照")
    round_key = fields.CharField(
        max_length=20,
        default=ROUND_T1,
        description="handboard/t1/t2/t3",
    )
    title = fields.CharField(max_length=200, description="标题")
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="draft/pending/approved/issued/closed/rejected",
    )
    project_requirements = fields.TextField(null=True, description="项目侧相关要求")
    project_attachments = fields.JSONField(default=list, description="项目侧附件")
    electronics_requirements = fields.TextField(null=True, description="电子侧相关要求")
    electronics_attachments = fields.JSONField(default=list, description="电子侧附件")
    electronics_status = fields.CharField(max_length=20, default="draft")
    structure_requirements = fields.TextField(null=True, description="结构侧相关要求")
    structure_attachments = fields.JSONField(default=list, description="结构侧附件")
    structure_status = fields.CharField(max_length=20, default="draft")
    manufacturing_opinion = fields.TextField(null=True, description="制造会签意见")
    quality_opinion = fields.TextField(null=True, description="质量会签意见")
    remarks = fields.TextField(null=True)
    submitted_at = fields.DatetimeField(null=True)
    approved_at = fields.DatetimeField(null=True)
    issued_at = fields.DatetimeField(null=True)
    closed_at = fields.DatetimeField(null=True)
    created_by = fields.IntField(null=True)
    created_by_name = fields.CharField(max_length=100, null=True)
    updated_by = fields.IntField(null=True)
    updated_by_name = fields.CharField(max_length=100, null=True)
    deleted_at = fields.DatetimeField(null=True)
