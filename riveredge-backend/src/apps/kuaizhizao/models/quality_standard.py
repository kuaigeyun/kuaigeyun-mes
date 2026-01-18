"""
质检标准数据模型模块

定义质检标准数据模型，用于管理物料的质量检验标准。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import fields
from core.models.base import BaseModel


class QualityStandard(BaseModel):
    """
    质检标准模型

    定义物料的质量检验标准，包括检验项目、检验方法、合格标准等。
    可以关联到物料，在创建检验单时自动引用。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        standard_code: 标准编码
        standard_name: 标准名称
        material_id: 关联物料ID（可选，为空则适用于所有物料）
        material_code: 关联物料编码（冗余字段）
        material_name: 关联物料名称（冗余字段）
        standard_type: 标准类型（来料检验/过程检验/成品检验）
        inspection_items: 检验项目（JSON格式）
        inspection_methods: 检验方法（JSON格式）
        acceptance_criteria: 合格标准（JSON格式）
        version: 版本号
        effective_date: 生效日期
        expiry_date: 失效日期（可选）
        is_active: 是否启用
        created_by: 创建人ID
        updated_by: 更新人ID
        remarks: 备注
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_quality_standards"
        indexes = [
            ("tenant_id",),
            ("standard_code",),
            ("material_id",),
            ("standard_type",),
            ("is_active",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    standard_code = fields.CharField(max_length=50, unique=True, description="标准编码")
    standard_name = fields.CharField(max_length=200, description="标准名称")
    standard_type = fields.CharField(max_length=50, description="标准类型（incoming/process/finished）")

    # 关联物料（可选）
    material_id = fields.IntField(null=True, description="关联物料ID（为空则适用于所有物料）")
    material_code = fields.CharField(max_length=50, null=True, description="关联物料编码（冗余字段）")
    material_name = fields.CharField(max_length=200, null=True, description="关联物料名称（冗余字段）")

    # 标准内容（JSON格式）
    inspection_items = fields.JSONField(null=True, description="检验项目列表（JSON格式）")
    inspection_methods = fields.JSONField(null=True, description="检验方法列表（JSON格式）")
    acceptance_criteria = fields.JSONField(null=True, description="合格标准（JSON格式）")

    # 版本管理
    version = fields.CharField(max_length=20, default="1.0", description="版本号")
    effective_date = fields.DateField(null=True, description="生效日期")
    expiry_date = fields.DateField(null=True, description="失效日期")

    # 状态
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"质检标准 - {self.standard_name} ({self.standard_code})"
