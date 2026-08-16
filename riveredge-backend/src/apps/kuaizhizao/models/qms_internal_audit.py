"""质量体系 - 内部审核"""

from tortoise import fields

from core.models.base import BaseModel


class QmsInternalAudit(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_qms_internal_audits"
        table_description = "快格轻制造 - 质量体系内部审核"
        indexes = [
            ("tenant_id",),
            ("audit_code",),
            ("status",),
            ("planned_date",),
            ("iso_clause_id",),
        ]
        unique_together = [("tenant_id", "audit_code")]

    id = fields.IntField(pk=True, description="主键ID")
    audit_code = fields.CharField(max_length=50, description="内审编码")
    title = fields.CharField(max_length=200, description="审核主题")
    audit_scope = fields.CharField(max_length=500, null=True, description="审核范围")
    iso_clause = fields.CharField(max_length=100, null=True, description="涉及条款")
    iso_clause_id = fields.IntField(null=True, description="ISO条款ID")
    status = fields.CharField(max_length=20, default="planned", description="planned/in_progress/completed/closed")
    planned_date = fields.DatetimeField(null=True, description="计划日期")
    completed_date = fields.DatetimeField(null=True, description="完成日期")
    lead_auditor = fields.CharField(max_length=100, null=True, description="审核组长")
    audit_team = fields.TextField(null=True, description="审核组成员")
    checklist = fields.TextField(null=True, description="检查表/要点")
    findings = fields.TextField(null=True, description="不符合项与观察项")
    conclusion = fields.TextField(null=True, description="审核结论")
    finding_links = fields.JSONField(null=True, description="不符合项关联证据（含8D）")
    training_refs = fields.JSONField(null=True, description="培训引用")
    calibration_refs = fields.JSONField(null=True, description="校准引用")
    attachments = fields.JSONField(null=True, description="附件")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
