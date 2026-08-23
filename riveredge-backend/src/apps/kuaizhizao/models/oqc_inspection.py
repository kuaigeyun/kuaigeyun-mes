"""
出货检验（OQC）模型
"""

from tortoise import fields

from core.models.base import BaseModel


class OQCInspection(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_oqc_inspections"
        table_description = "快格轻制造 - OQC 出货检验单"
        indexes = [
            ("tenant_id",),
            ("inspection_code",),
            ("source_type", "source_id"),
            ("shipment_notice_id",),
            ("sales_order_id",),
            ("customer_id",),
            ("material_id",),
            ("status",),
            ("quality_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "inspection_code")]

    id = fields.IntField(pk=True, description="主键ID")
    inspection_code = fields.CharField(max_length=50, description="检验单编码")

    source_type = fields.CharField(max_length=20, default="shipment_notice", description="来源类型")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")
    shipment_notice_id = fields.IntField(null=True, description="发货通知单ID")
    shipment_notice_code = fields.CharField(max_length=50, null=True, description="发货通知单编码")
    sales_order_id = fields.IntField(null=True, description="销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码")
    customer_id = fields.IntField(null=True, description="客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")

    material_id = fields.IntField(description="成品物料ID")
    material_code = fields.CharField(max_length=50, description="成品物料编码")
    material_name = fields.CharField(max_length=200, description="成品物料名称")
    material_unit = fields.CharField(max_length=20, null=True, description="物料单位（基础单位）")
    batch_number = fields.CharField(max_length=50, null=True, description="批次号")

    inspection_quantity = fields.DecimalField(max_digits=14, decimal_places=4, description="检验数量")
    qualified_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="不合格数量")

    inspection_result = fields.CharField(max_length=20, default="待检验", description="检验结果")
    quality_status = fields.CharField(max_length=20, default="合格", description="质量状态")
    release_decision = fields.CharField(max_length=20, default="pending", description="放行结论")
    release_note = fields.TextField(null=True, description="放行说明")

    inspector_id = fields.IntField(null=True, description="检验人ID")
    inspector_name = fields.CharField(max_length=100, null=True, description="检验人姓名")
    inspection_time = fields.DatetimeField(null=True, description="检验时间")
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")

    status = fields.CharField(max_length=20, default="待检验", description="单据状态")
    attachments = fields.JSONField(null=True, description="附件列表")
    notes = fields.TextField(null=True, description="备注")
    inspection_standard = fields.TextField(null=True, description="检验标准")
    other_checks = fields.JSONField(null=True, description="检验方案/标准模板（JSON）")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
