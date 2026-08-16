"""质量体系 - 受控体系文件"""

from tortoise import fields

from core.models.base import BaseModel


class QmsSystemDocument(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_qms_system_documents"
        table_description = "快格轻制造 - 质量体系受控文件"
        indexes = [
            ("tenant_id",),
            ("document_code",),
            ("doc_type",),
            ("status",),
            ("iso_clause",),
            ("iso_clause_id",),
        ]
        unique_together = [("tenant_id", "document_code")]

    id = fields.IntField(pk=True, description="主键ID")
    document_code = fields.CharField(max_length=50, description="文件编码")
    title = fields.CharField(max_length=200, description="文件标题")
    doc_type = fields.CharField(max_length=30, default="procedure", description="文件类型")
    version = fields.CharField(max_length=30, default="A0", description="版本号")
    status = fields.CharField(max_length=20, default="draft", description="状态 draft/effective/obsolete")
    iso_clause = fields.CharField(max_length=50, null=True, description="ISO条款")
    iso_clause_id = fields.IntField(null=True, description="ISO条款ID")
    content = fields.TextField(null=True, description="正文摘要/内容")
    file_url = fields.CharField(max_length=500, null=True, description="附件或外链")
    effective_at = fields.DatetimeField(null=True, description="生效时间")
    obsolete_at = fields.DatetimeField(null=True, description="作废时间")
    next_review_at = fields.DatetimeField(null=True, description="下次复审日期")
    owner_name = fields.CharField(max_length=100, null=True, description="责任人")
    evidence_links = fields.JSONField(null=True, description="检验/改进证据链接")
    training_refs = fields.JSONField(null=True, description="培训引用（跨应用）")
    attachments = fields.JSONField(null=True, description="附件")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
