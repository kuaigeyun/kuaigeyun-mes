"""R-02 实验委托单（快研发通用壳）。"""

from tortoise import fields

from core.models.base import BaseModel


class LabRequest(BaseModel):
    """实验委托单头。"""

    class Meta:
        table = "apps_kuaiplm_lab_requests"
        table_description = "快研发 - 实验委托"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "business_type"),
            ("tenant_id", "expected_complete_at"),
            ("tenant_id", "priority"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=50, description="委托单号")
    business_type = fields.CharField(
        max_length=40,
        default="general",
        description="iqc/rd/project_material/project_product/outsource/general",
    )
    title = fields.CharField(max_length=200, description="试验名称/标题")
    status = fields.CharField(
        max_length=30,
        default="draft",
        description="draft/pending_review/pending/in_lab/completed/rejected/revoked",
    )
    priority = fields.CharField(max_length=20, default="normal", description="normal/urgent")
    project_id = fields.IntField(null=True, description="研发项目ID")
    project_code = fields.CharField(max_length=80, null=True, description="项目代号")
    material_id = fields.IntField(null=True)
    material_code = fields.CharField(max_length=80, null=True)
    material_name = fields.CharField(max_length=200, null=True)
    sample_desc = fields.TextField(null=True, description="样品说明")
    test_items = fields.TextField(null=True, description="试验项目说明")
    test_reason = fields.TextField(null=True, description="试验原由")
    outsource_price = fields.DecimalField(
        max_digits=18, decimal_places=4, null=True, description="委外试验价格（#64 采购填）"
    )
    price_filled_by = fields.IntField(null=True, description="价格填写人")
    price_filled_by_name = fields.CharField(max_length=100, null=True, description="价格填写人姓名")
    price_filled_at = fields.DatetimeField(null=True, description="价格填写时刻")
    requester_name = fields.CharField(max_length=100, null=True, description="委托人")
    lab_owner_name = fields.CharField(max_length=100, null=True, description="实验室受理人")
    expected_complete_at = fields.DatetimeField(null=True, description="预计完成时刻")
    started_at = fields.DatetimeField(null=True)
    completed_at = fields.DatetimeField(null=True)
    result_summary = fields.TextField(null=True)
    judgment = fields.CharField(max_length=20, null=True, description="pass/fail/ng/na")
    report_file_uuid = fields.CharField(max_length=36, null=True)
    report_url = fields.CharField(max_length=500, null=True)
    report_status = fields.CharField(
        max_length=30,
        default="none",
        description="none/draft/pending/approved/rejected",
    )
    report_title = fields.CharField(max_length=200, null=True, description="报告标题")
    report_submitted_at = fields.DatetimeField(null=True)
    report_submitted_by = fields.IntField(null=True)
    report_submitted_by_name = fields.CharField(max_length=100, null=True)
    report_approved_at = fields.DatetimeField(null=True)
    report_approved_by = fields.IntField(null=True)
    report_approved_by_name = fields.CharField(max_length=100, null=True)
    report_rejected_at = fields.DatetimeField(null=True)
    report_reject_reason = fields.TextField(null=True)
    attachments = fields.JSONField(null=True)
    extension_payload = fields.JSONField(null=True, description="行业扩展载荷（profile）")
    submitted_at = fields.DatetimeField(null=True)
    accepted_at = fields.DatetimeField(null=True)
    rejected_at = fields.DatetimeField(null=True)
    reject_reason = fields.TextField(null=True)
    revoked_at = fields.DatetimeField(null=True)
    revoke_reason = fields.TextField(null=True)
    remarks = fields.TextField(null=True)
    created_by = fields.IntField(null=True)
    created_by_name = fields.CharField(max_length=100, null=True)
    updated_by = fields.IntField(null=True)
    updated_by_name = fields.CharField(max_length=100, null=True)
    deleted_at = fields.DatetimeField(null=True)


class LabRequestMeasureItem(BaseModel):
    """实验委托实测行：标准版本化快照 + 实测原样 + 服务端判定（禁止读侧重算）。"""

    class Meta:
        table = "apps_kuaiplm_lab_request_measure_items"
        table_description = "快研发 - 实验委托实测行"
        indexes = [
            ("tenant_id", "lab_request_id"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    lab_request_id = fields.IntField(description="委托单ID")
    line_no = fields.IntField(default=1, description="行号")
    item_code = fields.CharField(max_length=80, null=True, description="试验项编码")
    item_name = fields.CharField(max_length=200, description="试验项名称")
    unit = fields.CharField(max_length=40, null=True, description="单位")
    compare_type = fields.CharField(
        max_length=20,
        default="range",
        description="range/eq/gte/lte/na",
    )
    standard_min = fields.CharField(max_length=80, null=True, description="下限（原样字符串）")
    standard_max = fields.CharField(max_length=80, null=True, description="上限（原样字符串）")
    standard_value = fields.CharField(max_length=80, null=True, description="标准值（原样）")
    rule_version = fields.CharField(
        max_length=80,
        null=True,
        description="判定规则版本号（写入判定时冻结）",
    )
    judgment_rule_id = fields.IntField(
        null=True, description="选用的判定规则主数据 ID（快照时记录）"
    )
    measured_value = fields.CharField(max_length=200, null=True, description="实测值原样")
    auto_judgment = fields.CharField(
        max_length=20,
        null=True,
        description="服务端自动判定 pass/fail/ng/na",
    )
    judgment_snapshot = fields.JSONField(
        null=True,
        description="判定输入/规则/结果快照；读侧不得重算",
    )
    manual_judgment = fields.CharField(max_length=20, null=True, description="人工复核判定")
    manual_reason = fields.TextField(null=True, description="人工复核原因")
    manual_by = fields.IntField(null=True)
    manual_by_name = fields.CharField(max_length=100, null=True)
    manual_at = fields.DatetimeField(null=True)
    final_judgment = fields.CharField(
        max_length=20,
        null=True,
        description="最终判定（人工优先，否则自动）",
    )
    quality_exception_id = fields.IntField(null=True, description="关联质量异常ID")
    quality_exception_uuid = fields.CharField(
        max_length=36, null=True, description="关联质量异常 UUID 快照"
    )
    exception_linked_at = fields.DatetimeField(null=True, description="NG 关联异常时刻")
    remarks = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)
