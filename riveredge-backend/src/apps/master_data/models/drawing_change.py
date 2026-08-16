"""图纸工程变更（并进快研发变更台，不新开页）"""

from tortoise import fields

from core.models.base import BaseModel


class DrawingChange(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_changes"
        table_description = "基础数据管理 - 图纸工程变更"
        indexes = [
            ("tenant_id",),
            ("drawing_id",),
            ("status",),
            ("change_type",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    drawing_id = fields.IntField(description="图纸ID")
    drawing_uuid = fields.CharField(max_length=36, description="图纸UUID")
    drawing_code = fields.CharField(max_length=50, description="图号")
    drawing_name = fields.CharField(max_length=200, description="图纸名称")
    drawing_revision = fields.CharField(max_length=20, description="变更前修订版")
    change_type = fields.CharField(
        max_length=50,
        description="revision/file_replace/obsolete/metadata/other",
    )
    change_content = fields.JSONField(null=True, description="变更内容")
    change_reason = fields.TextField(null=True, description="变更原因")
    status = fields.CharField(max_length=20, default="draft", description="draft/pending/approved/rejected/executed/cancelled")
    applicant_id = fields.IntField(description="申请人ID")
    approver_id = fields.IntField(null=True, description="审批人ID")
    approval_comment = fields.TextField(null=True, description="审批意见")
    applied_at = fields.DatetimeField(null=True, description="执行时间")
    result_drawing_uuid = fields.CharField(max_length=36, null=True, description="执行后新图纸UUID")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")
