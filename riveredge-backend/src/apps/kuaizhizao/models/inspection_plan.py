"""
质检方案数据模型模块

定义质检方案及检验步骤数据模型，用于管理可复用的检验流程模板。

Author: RiverEdge Team
Date: 2026-02-26
"""

from tortoise import fields
from core.models.base import BaseModel


class InspectionPlan(BaseModel):
    """
    质检方案模型

    定义可复用的检验流程模板，包含多个检验步骤，可关联物料/工序。
    创建检验单时可引用方案自动带入检验项。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        plan_code: 方案编码
        plan_name: 方案名称
        plan_type: 类型（incoming/process/finished）
        material_id: 适用物料ID（可选）
        material_code, material_name: 物料冗余
        operation_id: 适用工序ID（过程检验时）
        version: 版本号
        is_active: 是否启用
        remarks: 备注
        deleted_at: 软删除
    """

    class Meta:
        table = "apps_kuaizhizao_inspection_plans"
        table_description = "快格轻制造 - 质检方案"
        indexes = [
            ("tenant_id",),
            ("plan_code",),
            ("plan_type",),
            ("material_id",),
            ("is_active",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "plan_code")]

    id = fields.IntField(pk=True, description="主键ID")
    plan_code = fields.CharField(max_length=50, description="方案编码")
    plan_name = fields.CharField(max_length=200, description="方案名称")
    plan_type = fields.CharField(max_length=50, description="类型（incoming/process/finished）")

    material_id = fields.IntField(null=True, description="适用物料ID（可选）")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码（冗余）")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称（冗余）")
    operation_id = fields.IntField(null=True, description="适用工序ID（过程检验时）")

    version = fields.CharField(max_length=20, default="1.0", description="版本号")
    is_active = fields.BooleanField(default=True, description="是否启用")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"质检方案 - {self.plan_name} ({self.plan_code})"


class InspectionPlanStep(BaseModel):
    """
    质检方案步骤模型

    质检方案中的单个检验步骤，支持引用质检标准或内嵌检验项。

    Attributes:
        id: 主键ID
        plan_id: 关联质检方案ID
        sequence: 步骤序号
        inspection_item: 检验项目名称
        inspection_method: 检验方法
        acceptance_criteria: 合格标准
        sampling_type: 抽样方式（full/sampling）
        quality_standard_id: 引用的质检标准ID（可选）
        remarks: 备注
    """

    class Meta:
        table = "apps_kuaizhizao_inspection_plan_steps"
        table_description = "快格轻制造 - 质检方案步骤"
        indexes = [
            ("plan_id",),
            ("sequence",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    plan = fields.ForeignKeyField(
        "models.InspectionPlan",
        related_name="steps",
        on_delete=fields.CASCADE,
        description="关联质检方案",
    )
    sequence = fields.IntField(default=0, description="步骤序号")
    inspection_item = fields.CharField(max_length=200, description="检验项目名称")
    inspection_method = fields.CharField(max_length=200, null=True, description="检验方法")
    acceptance_criteria = fields.TextField(null=True, description="合格标准")
    sampling_type = fields.CharField(max_length=20, default="full", description="抽样方式（full/sampling）")
    quality_standard_id = fields.IntField(null=True, description="引用的质检标准ID（可选）")
    remarks = fields.TextField(null=True, description="备注")

    def __str__(self):
        return f"步骤{self.sequence}: {self.inspection_item}"
