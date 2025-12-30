"""
来料检验单模型

提供来料检验单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class IncomingInspection(BaseModel):
    """
    来料检验单

    用于记录采购物料到货后的质量检验信息
    """
    tenant_id = fields.IntField(description="租户ID")
    inspection_code = fields.CharField(max_length=50, unique=True, description="检验单编码")

    # 关联采购入库单
    purchase_receipt_id = fields.IntField(description="采购入库单ID")
    purchase_receipt_code = fields.CharField(max_length=50, description="采购入库单编码")

    # 供应商信息
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 检验信息
    inspection_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="检验数量")
    qualified_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="不合格数量")

    # 检验结果
    inspection_result = fields.CharField(max_length=20, default="待检验", description="检验结果")
    quality_status = fields.CharField(max_length=20, default="合格", description="质量状态")

    # 检验人信息
    inspector_id = fields.IntField(null=True, description="检验人ID")
    inspector_name = fields.CharField(max_length=100, null=True, description="检验人姓名")
    inspection_time = fields.DatetimeField(null=True, description="检验时间")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 检验标准和方法
    inspection_standard = fields.TextField(null=True, description="检验标准")
    inspection_method = fields.CharField(max_length=100, null=True, description="检验方法")
    test_equipment = fields.CharField(max_length=200, null=True, description="测试设备")

    # 详细检验结果
    appearance_check = fields.CharField(max_length=20, null=True, description="外观检查")
    dimension_check = fields.CharField(max_length=20, null=True, description="尺寸检查")
    performance_check = fields.CharField(max_length=20, null=True, description="性能检查")
    other_checks = fields.JSONField(null=True, description="其他检查项目（JSON格式）")

    # 不合格处理
    nonconformance_reason = fields.TextField(null=True, description="不合格原因")
    disposition = fields.CharField(max_length=50, null=True, description="处理方式")
    corrective_action = fields.TextField(null=True, description="纠正措施")

    status = fields.CharField(max_length=20, default="待检验", description="单据状态")
    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_incoming_inspections"
        table_description = "快格轻制造 - 来料检验单"
        indexes = [
            ("tenant_id", "purchase_receipt_id"),
            ("supplier_id",),
            ("material_id",),
            ("inspection_result",),
            ("quality_status",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
