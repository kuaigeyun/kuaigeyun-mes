"""
补货建议数据模型模块

定义补货建议数据模型，基于库存预警生成补货建议。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import fields
from core.models.base import BaseModel


class ReplenishmentSuggestion(BaseModel):
    """
    补货建议模型

    基于库存预警生成补货建议，包括建议补货数量、建议补货时间等。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        current_quantity: 当前库存数量
        safety_stock: 安全库存
        min_stock: 最低库存
        max_stock: 最高库存
        suggested_quantity: 建议补货数量
        priority: 优先级（high/medium/low）
        suggestion_type: 建议类型（low_stock/demand_based/seasonal）
        estimated_delivery_days: 预计交货天数
        suggested_order_date: 建议下单日期
        supplier_id: 供应商ID（可选）
        supplier_name: 供应商名称（可选）
        status: 状态（pending/processed/ignored）
        processed_by: 处理人ID
        processed_at: 处理时间
        processing_notes: 处理备注
        alert_id: 关联的预警ID（可选）
        related_demand_id: 关联的需求ID（可选）
        related_demand_code: 关联的需求编码（可选）
        remarks: 备注
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_replenishment_suggestions"
        table_description = "快格轻制造 - 补货建议"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("warehouse_id",),
            ("status",),
            ("priority",),
            ("suggestion_type",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")

    # 仓库信息
    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, description="仓库名称")

    # 库存信息
    current_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="当前库存数量")
    safety_stock = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="安全库存")
    min_stock = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="最低库存")
    max_stock = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="最高库存")

    # 补货建议信息
    suggested_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="建议补货数量")
    priority = fields.CharField(max_length=20, default="medium", description="优先级（high/medium/low）")
    suggestion_type = fields.CharField(max_length=20, default="low_stock", description="建议类型（low_stock/demand_based/seasonal）")

    # 时间信息
    estimated_delivery_days = fields.IntField(null=True, description="预计交货天数")
    suggested_order_date = fields.DatetimeField(null=True, description="建议下单日期")

    # 供应商信息（可选）
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称")

    # 状态
    status = fields.CharField(max_length=20, default="pending", description="状态（pending/processed/ignored）")

    # 处理信息
    processed_by = fields.IntField(null=True, description="处理人ID")
    processed_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    processed_at = fields.DatetimeField(null=True, description="处理时间")
    processing_notes = fields.TextField(null=True, description="处理备注")

    # 关联信息
    alert_id = fields.IntField(null=True, description="关联的预警ID")
    related_demand_id = fields.IntField(null=True, description="关联的需求ID")
    related_demand_code = fields.CharField(max_length=50, null=True, description="关联的需求编码")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"补货建议 - {self.material_name}"
