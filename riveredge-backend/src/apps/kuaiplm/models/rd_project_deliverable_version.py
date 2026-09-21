"""研发项目交付物版本链（INF-05 / R-01）。

头表 RdProjectDeliverable 保留当前版本快照；履历写入本表。
版本状态使用 INF-05 口径：draft / pending / effective / obsolete / rejected。
"""

from tortoise import fields

from core.models.base import BaseModel


class RdProjectDeliverableVersion(BaseModel):
    class Meta:
        table = "apps_kuaiplm_rd_project_deliverable_versions"
        table_description = "快研发 - 项目交付物版本链"
        unique_together = [("tenant_id", "deliverable_id", "version")]
        indexes = [
            ("tenant_id", "deliverable_id", "status"),
            ("tenant_id", "deliverable_id", "is_effective"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True, description="主键")
    deliverable_id = fields.IntField(description="交付物头表 ID")
    project_id = fields.IntField(description="项目 ID")
    version = fields.CharField(max_length=30, description="版本号")
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="draft/pending/effective/obsolete/rejected",
    )
    is_effective = fields.BooleanField(default=False, description="是否当前生效版")
    name = fields.CharField(max_length=200, description="名称快照")
    description = fields.TextField(null=True, description="描述快照")
    deliverable_type = fields.CharField(max_length=50, null=True, description="类型快照")
    file_url = fields.CharField(max_length=500, null=True, description="文件 URL")
    file_name = fields.CharField(max_length=200, null=True, description="文件名")
    file_uuid = fields.CharField(max_length=36, null=True, description="core file UUID")
    material_code = fields.CharField(max_length=80, null=True, description="关联料号快照")
    legacy_material_code = fields.CharField(max_length=80, null=True, description="沿用旧料号快照")
    change_summary = fields.TextField(null=True, description="升版说明")
    effective_at = fields.DatetimeField(null=True, description="生效时间")
    obsolete_at = fields.DatetimeField(null=True, description="作废时间")
    created_by = fields.IntField(null=True, description="制定人")
    created_by_name = fields.CharField(max_length=100, null=True, description="制定人姓名")
    updated_by = fields.IntField(null=True, description="更新人")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
