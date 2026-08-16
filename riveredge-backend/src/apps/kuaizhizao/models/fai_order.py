"""FAI 首件检验单"""

from tortoise import fields

from core.models.base import BaseModel


class FaiOrder(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_fai_orders"
        table_description = "快格轻制造 - FAI 首件检验单"
        indexes = [
            ("tenant_id",),
            ("fai_code",),
            ("status",),
            ("material_id",),
            ("work_order_id",),
        ]
        unique_together = [("tenant_id", "fai_code")]

    id = fields.IntField(pk=True, description="主键ID")
    fai_code = fields.CharField(max_length=50, description="FAI 编码")
    title = fields.CharField(max_length=200, description="标题")
    trigger_reason = fields.CharField(
        max_length=30, default="new_part", description="new_part/ecn/changeover/restart/customer"
    )
    status = fields.CharField(max_length=20, default="draft", description="单据状态")
    conclusion = fields.CharField(max_length=20, default="pending", description="pending/pass/fail")

    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    drawing_no = fields.CharField(max_length=100, null=True, description="图纸号")
    drawing_revision = fields.CharField(max_length=50, null=True, description="图纸版本")
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单号")
    inspection_plan_id = fields.IntField(null=True, description="来源质检方案ID")
    inspection_plan_code = fields.CharField(max_length=50, null=True, description="来源质检方案编码")

    # Form1 / Form2 摘要
    part_number = fields.CharField(max_length=100, null=True, description="零件号")
    part_name = fields.CharField(max_length=200, null=True, description="零件名称")
    serial_number = fields.CharField(max_length=100, null=True, description="序列号")
    lot_number = fields.CharField(max_length=100, null=True, description="批次号")
    material_spec = fields.CharField(max_length=200, null=True, description="材料规格")
    process_spec = fields.TextField(null=True, description="工艺/特殊过程摘要")
    organization_name = fields.CharField(max_length=200, null=True, description="组织/供应商名称")

    sample_size = fields.IntField(default=1, description="样本件数（Cp/Cpk）")
    cpk_summary = fields.JSONField(null=True, description="Cp/Cpk 摘要")
    drawing_file_url = fields.CharField(max_length=500, null=True, description="图纸文件")
    balloon_candidates = fields.JSONField(null=True, description="OCR/气泡候选（待确认）")
    attachments = fields.JSONField(null=True, description="附件")
    remarks = fields.TextField(null=True, description="备注")

    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    approved_at = fields.DatetimeField(null=True, description="批准时间")
    approved_by = fields.IntField(null=True, description="批准人")
    approved_by_name = fields.CharField(max_length=100, null=True, description="批准人姓名")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
