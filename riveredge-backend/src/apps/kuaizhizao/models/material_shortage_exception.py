"""
缺料异常记录数据模型模块

定义缺料异常记录数据模型，用于记录和处理工单缺料异常。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialShortageException(BaseModel):
    """
    缺料异常记录模型

    用于记录工单缺料异常信息，包括预警级别、处理状态等。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        work_order_id: 工单ID
        work_order_code: 工单编码
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        shortage_quantity: 缺料数量
        available_quantity: 可用数量
        required_quantity: 需求数量
        alert_level: 预警级别（low/medium/high/critical）
        status: 处理状态（pending/processing/resolved/cancelled）
        alternative_material_id: 替代物料ID（可选）
        alternative_material_code: 替代物料编码（可选）
        alternative_material_name: 替代物料名称（可选）
        suggested_action: 建议操作（purchase/substitute/adjust）
        handled_by: 处理人ID
        handled_by_name: 处理人姓名
        handled_at: 处理时间
        remarks: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_material_shortage_exceptions"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("material_id",),
            ("alert_level",),
            ("status",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 工单信息
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")

    # 缺料信息
    shortage_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="缺料数量")
    available_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="可用数量")
    required_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="需求数量")

    # 预警和处理信息
    alert_level = fields.CharField(max_length=20, default="medium", description="预警级别")
    status = fields.CharField(max_length=20, default="pending", description="处理状态")

    # 替代物料信息（可选）
    alternative_material_id = fields.IntField(null=True, description="替代物料ID（可选）")
    alternative_material_code = fields.CharField(max_length=50, null=True, description="替代物料编码（可选）")
    alternative_material_name = fields.CharField(max_length=200, null=True, description="替代物料名称（可选）")

    # 建议操作
    suggested_action = fields.CharField(max_length=50, null=True, description="建议操作")

    # 处理信息
    handled_by = fields.IntField(null=True, description="处理人ID")
    handled_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handled_at = fields.DatetimeField(null=True, description="处理时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.work_order_code} - {self.material_name} (缺{self.shortage_quantity})"

