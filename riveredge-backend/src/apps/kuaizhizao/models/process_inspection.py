"""
过程检验单模型

提供过程检验单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class ProcessInspection(BaseModel):
    """
    过程检验单

    用于记录生产过程中各工序的质量检验信息
    """
    tenant_id = fields.IntField(description="租户ID")
    inspection_code = fields.CharField(max_length=50, unique=True, description="检验单编码")

    # 关联工单和工序
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    operation_id = fields.IntField(description="工序ID")
    operation_code = fields.CharField(max_length=50, description="工序编码")
    operation_name = fields.CharField(max_length=200, description="工序名称")

    # 生产信息
    workshop_id = fields.IntField(null=True, description="车间ID")
    workshop_name = fields.CharField(max_length=100, null=True, description="车间名称")
    workstation_id = fields.IntField(null=True, description="工位ID")
    workstation_name = fields.CharField(max_length=100, null=True, description="工位名称")

    # 物料信息
    material_id = fields.IntField(description="生产物料ID")
    material_code = fields.CharField(max_length=50, description="生产物料编码")
    material_name = fields.CharField(max_length=200, description="生产物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")

    # 检验信息
    batch_number = fields.CharField(max_length=50, null=True, description="生产批次号")
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
    process_parameters = fields.JSONField(null=True, description="过程参数检查（JSON格式）")
    quality_characteristics = fields.JSONField(null=True, description="质量特性检查（JSON格式）")
    measurement_data = fields.JSONField(null=True, description="测量数据（JSON格式）")

    # 不合格处理
    nonconformance_reason = fields.TextField(null=True, description="不合格原因")
    disposition = fields.CharField(max_length=50, null=True, description="处理方式")
    corrective_action = fields.TextField(null=True, description="纠正措施")
    preventive_action = fields.TextField(null=True, description="预防措施")

    status = fields.CharField(max_length=20, default="待检验", description="单据状态")
    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_process_inspections"
        table_description = "快格轻制造 - 过程检验单"
        indexes = [
            ("tenant_id", "work_order_id"),
            ("tenant_id", "operation_id"),
            ("material_id",),
            ("inspection_result",),
            ("quality_status",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
