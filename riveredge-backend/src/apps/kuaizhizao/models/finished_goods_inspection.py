"""
成品检验单模型

提供成品检验单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class FinishedGoodsInspection(BaseModel):
    """
    成品检验单

    用于记录成品入库前或出厂前的最终质量检验信息
    """
    tenant_id = fields.IntField(description="租户ID")
    inspection_code = fields.CharField(max_length=50, unique=True, description="检验单编码")

    # 关联来源单据
    source_type = fields.CharField(max_length=20, description="来源单据类型")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")

    # 工单信息
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")

    # 销售订单信息（MTO模式）
    sales_order_id = fields.IntField(null=True, description="销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码")
    customer_id = fields.IntField(null=True, description="客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")

    # 成品信息
    material_id = fields.IntField(description="成品物料ID")
    material_code = fields.CharField(max_length=50, description="成品物料编码")
    material_name = fields.CharField(max_length=200, description="成品物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="成品规格")

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
    appearance_check = fields.CharField(max_length=20, null=True, description="外观检查")
    dimension_check = fields.CharField(max_length=20, null=True, description="尺寸检查")
    performance_check = fields.CharField(max_length=20, null=True, description="性能检查")
    function_test = fields.CharField(max_length=20, null=True, description="功能测试")
    packaging_check = fields.CharField(max_length=20, null=True, description="包装检查")
    documentation_check = fields.CharField(max_length=20, null=True, description="文件检查")
    other_checks = fields.JSONField(null=True, description="其他检查项目（JSON格式）")

    # 测量数据
    measurement_data = fields.JSONField(null=True, description="测量数据（JSON格式）")

    # 不合格处理
    nonconformance_reason = fields.TextField(null=True, description="不合格原因")
    disposition = fields.CharField(max_length=50, null=True, description="处理方式")
    corrective_action = fields.TextField(null=True, description="纠正措施")
    preventive_action = fields.TextField(null=True, description="预防措施")

    # 出厂信息
    release_certificate = fields.CharField(max_length=100, null=True, description="放行证书号")
    certificate_issued = fields.BooleanField(default=False, description="是否已出具证书")

    status = fields.CharField(max_length=20, default="待检验", description="单据状态")
    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_finished_goods_inspections"
        table_description = "快格轻制造 - 成品检验单"
        indexes = [
            ("tenant_id", "work_order_id"),
            ("tenant_id", "source_id"),
            ("material_id",),
            ("sales_order_id",),
            ("inspection_result",),
            ("quality_status",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
