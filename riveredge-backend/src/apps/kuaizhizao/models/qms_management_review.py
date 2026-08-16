"""质量体系 - 管理评审"""

from tortoise import fields

from core.models.base import BaseModel


class QmsManagementReview(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_qms_management_reviews"
        table_description = "快格轻制造 - 质量体系管理评审"
        indexes = [
            ("tenant_id",),
            ("review_code",),
            ("status",),
            ("review_date",),
        ]
        unique_together = [("tenant_id", "review_code")]

    id = fields.IntField(pk=True, description="主键ID")
    review_code = fields.CharField(max_length=50, description="管理评审编码")
    title = fields.CharField(max_length=200, description="评审主题")
    status = fields.CharField(max_length=20, default="draft", description="draft/in_progress/completed/closed")
    review_date = fields.DatetimeField(null=True, description="评审日期")
    chairperson = fields.CharField(max_length=100, null=True, description="主持人")
    attendees = fields.TextField(null=True, description="出席人员")
    inputs_summary = fields.TextField(null=True, description="评审输入摘要")
    outputs_summary = fields.TextField(null=True, description="评审输出/决议")
    input_links = fields.JSONField(null=True, description="输入证据（内审/报表/8D等）")
    training_refs = fields.JSONField(null=True, description="培训引用")
    calibration_refs = fields.JSONField(null=True, description="校准引用")
    attachments = fields.JSONField(null=True, description="附件")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
