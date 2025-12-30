"""
生产领料单明细模型

提供生产领料单明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionPickingItem(BaseModel):
    """
    生产领料单明细

    用于记录生产领料单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    picking_id = fields.IntField(description="领料单ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 需求数量
    required_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="需求数量")
    picked_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="已领料数量")
    remaining_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="剩余数量")

    # 库存信息
    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="仓库名称")
    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    # 状态
    status = fields.CharField(max_length=20, default="待领料", description="领料状态")
    picking_time = fields.DatetimeField(null=True, description="实际领料时间")

    # 批次信息（可选）
    batch_number = fields.CharField(max_length=50, null=True, description="批次号")
    expiry_date = fields.DateField(null=True, description="到期日期")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_production_picking_items"
        table_description = "快格轻制造 - 生产领料单明细"
        indexes = [
            ("tenant_id", "picking_id"),
            ("material_id",),
            ("warehouse_id",),
        ]
