"""R-11 质量投诉单（共享单头；类型走 business_type）。"""

from tortoise import fields

from core.models.base import BaseModel


class QualityComplaint(BaseModel):
    """质量投诉单头。"""

    class Meta:
        table = "apps_kuaizhizao_quality_complaints"
        table_description = "快制造 - 质量投诉"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "business_type"),
            ("tenant_id", "due_at"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=50, description="投诉单号")
    business_type = fields.CharField(
        max_length=30,
        default="iqc_incoming",
        description="iqc_incoming/line_incoming/pqc/oqc/customer",
    )
    title = fields.CharField(max_length=200, description="标题")
    status = fields.CharField(
        max_length=30,
        default="draft",
        description="draft/pending/approved/rejected/processing/closed/revoked",
    )
    defect_category = fields.CharField(
        max_length=50,
        null=True,
        description="缺陷分类（字典码：performance/structure/appearance 等）",
    )
    description = fields.TextField(null=True, description="问题描述")
    supplier_id = fields.IntField(null=True)
    supplier_code = fields.CharField(max_length=80, null=True)
    supplier_name = fields.CharField(max_length=200, null=True)
    customer_id = fields.IntField(null=True)
    customer_code = fields.CharField(max_length=80, null=True)
    customer_name = fields.CharField(max_length=200, null=True)
    material_id = fields.IntField(null=True)
    material_code = fields.CharField(max_length=80, null=True)
    material_name = fields.CharField(max_length=200, null=True)
    batch_no = fields.CharField(max_length=100, null=True, description="批次号")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True)
    unit = fields.CharField(max_length=20, null=True)
    sla_workdays = fields.IntField(default=5, description="工作日时效天数")
    due_at = fields.DatetimeField(null=True, description="要求完成时刻（工作日推算）")
    containment_due_at = fields.DatetimeField(
        null=True, description="围堵时效截止（客诉提交日站点17:00）"
    )
    corrective_sla_workdays = fields.IntField(
        null=True, description="纠正措施工作日时效（客诉默认3日）"
    )
    corrective_due_at = fields.DatetimeField(null=True, description="纠正措施截止时刻")
    supplier_response = fields.TextField(null=True, description="供方整改说明")
    supplier_response_attachments = fields.JSONField(null=True)
    attachments = fields.JSONField(null=True)
    export_masked = fields.BooleanField(
        default=False,
        description="屏蔽导出（不删除原始记录）",
    )
    eight_d_report_id = fields.IntField(null=True, description="关联 8D 报告 ID")
    source_inspection_type = fields.CharField(max_length=50, null=True)
    source_inspection_id = fields.IntField(null=True)
    submitted_at = fields.DatetimeField(null=True)
    approved_at = fields.DatetimeField(null=True)
    closed_at = fields.DatetimeField(null=True)
    closed_by = fields.IntField(null=True)
    closed_by_name = fields.CharField(max_length=100, null=True)
    revoked_at = fields.DatetimeField(null=True)
    revoked_by = fields.IntField(null=True)
    revoked_by_name = fields.CharField(max_length=100, null=True)
    revoke_reason = fields.TextField(null=True)
    remarks = fields.TextField(null=True)
    extension_payload = fields.JSONField(null=True, description="扩展载荷（检验/不良/根因对策等）")
    deleted_at = fields.DatetimeField(null=True)
