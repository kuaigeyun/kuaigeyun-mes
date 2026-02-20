"""
生产退料单明细模型

提供生产退料单明细数据模型定义。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionReturnItem(BaseModel):
    """
    生产退料单明细

    用于记录生产退料单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    return_id = fields.IntField(description="退料单ID")
    picking_item_id = fields.IntField(null=True, description="领料单明细ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 退料数量
    return_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="退料数量")

    # 库存信息
    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="仓库名称")
    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    # 状态
    status = fields.CharField(max_length=20, default="待退料", description="退料状态")
    return_time = fields.DatetimeField(null=True, description="实际退料时间")

    # 批次信息（可选）
    batch_number = fields.CharField(max_length=50, null=True, description="批次号")
    expiry_date = fields.DateField(null=True, description="到期日期")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_production_return_items"
        table_description = "快格轻制造 - 生产退料单明细"
        indexes = [
            ("tenant_id", "return_id"),
            ("material_id",),
            ("warehouse_id",),
        ]
