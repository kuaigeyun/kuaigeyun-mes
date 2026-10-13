"""
质量巡检单模型

无强制来源单据的任意抽检；车间/产线/工位/工序/工单仅作上下文。
"""

from tortoise import fields

from core.models.base import BaseModel


class QualityPatrol(BaseModel):
    """质量巡检（Patrol）"""

    class Meta:
        table = "apps_kuaizhizao_quality_patrols"
        table_description = "快格轻制造 - 质量巡检单"
        indexes = [
            ("tenant_id",),
            ("inspection_code",),
            ("material_id",),
            ("workshop_id",),
            ("work_order_id",),
            ("status",),
            ("quality_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "inspection_code")]

    id = fields.IntField(pk=True, description="主键ID")
    inspection_code = fields.CharField(max_length=50, description="巡检单编码")

    source_type = fields.CharField(max_length=30, null=True, description="可选来源类型")
    source_id = fields.IntField(null=True, description="可选来源单据ID")
    source_code = fields.CharField(max_length=50, null=True, description="可选来源单据编码")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, null=True, description="物料单位")
    batch_number = fields.CharField(max_length=100, null=True, description="批次号")

    workshop_id = fields.IntField(null=True, description="车间ID")
    workshop_name = fields.CharField(max_length=200, null=True, description="车间名称")
    production_line_id = fields.IntField(null=True, description="产线ID")
    production_line_name = fields.CharField(max_length=200, null=True, description="产线名称")
    workstation_id = fields.IntField(null=True, description="工位ID")
    workstation_name = fields.CharField(max_length=200, null=True, description="工位名称")
    operation_id = fields.IntField(null=True, description="工序ID")
    operation_name = fields.CharField(max_length=200, null=True, description="工序名称")
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")

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
        return f"质量巡检 - {self.inspection_code}"
