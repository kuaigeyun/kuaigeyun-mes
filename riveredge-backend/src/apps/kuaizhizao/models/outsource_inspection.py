"""
委外检验单模型

外协收货后的入厂检验，独立于来料检验（IQC）。
"""

from tortoise import fields

from core.models.base import BaseModel


class OutsourceInspection(BaseModel):
    """委外检验单（OSQC）"""

    class Meta:
        table = "apps_kuaizhizao_outsource_inspections"
        table_description = "快格轻制造 - 委外检验单"
        indexes = [
            ("tenant_id",),
            ("inspection_code",),
            ("outsource_receipt_id",),
            ("outsource_work_order_id",),
            ("supplier_id",),
            ("material_id",),
            ("status",),
            ("quality_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "inspection_code")]

    id = fields.IntField(pk=True, description="主键ID")
    inspection_code = fields.CharField(max_length=50, description="检验单编码")

    source_type = fields.CharField(
        max_length=30,
        default="outsource_receipt",
        description="来源类型（outsource_receipt）",
    )
    outsource_receipt_id = fields.IntField(null=True, description="委外收货单ID")
    outsource_receipt_code = fields.CharField(max_length=50, null=True, description="委外收货单编码")
    outsource_work_order_id = fields.IntField(null=True, description="委外工单ID")
    outsource_work_order_code = fields.CharField(max_length=50, null=True, description="委外工单编码")

    supplier_id = fields.IntField(null=True, description="委外供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="委外供应商名称")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, null=True, description="物料单位")
    batch_number = fields.CharField(max_length=100, null=True, description="批次号")

    inspection_quantity = fields.DecimalField(max_digits=14, decimal_places=4, description="检验数量")
    qualified_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="不合格数量")

    inspection_result = fields.CharField(max_length=20, default="待检验", description="检验结果")
    quality_status = fields.CharField(max_length=20, default="合格", description="质量状态")

    inspector_id = fields.IntField(null=True, description="检验人ID")
    inspector_name = fields.CharField(max_length=100, null=True, description="检验人姓名")
    inspection_time = fields.DatetimeField(null=True, description="检验时间")

    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    inspection_standard = fields.TextField(null=True, description="检验标准")
    other_checks = fields.JSONField(null=True, description="检验方案/标准模板（JSON）")

    nonconformance_reason = fields.TextField(null=True, description="不合格原因")
    disposition = fields.CharField(max_length=50, null=True, description="处理方式")
    corrective_action = fields.TextField(null=True, description="纠正措施")

    status = fields.CharField(max_length=20, default="待检验", description="单据状态")
    attachments = fields.JSONField(null=True, description="附件列表")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self) -> str:
        return f"委外检验 - {self.inspection_code}"
