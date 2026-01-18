"""
销售出库单明细模型

提供销售出库单明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesDeliveryItem(BaseModel):
    """
    销售出库单明细

    用于记录销售出库单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    delivery_id = fields.IntField(description="出库单ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 出库数量和价格
    delivery_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="出库数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="金额")

    # 库位信息
    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    # 批次信息（批号和序列号选择功能增强）
    batch_number = fields.CharField(max_length=50, null=True, description="批次号")
    expiry_date = fields.DateField(null=True, description="到期日期")
    
    # 序列号信息（批号和序列号选择功能增强）
    serial_numbers = fields.JSONField(null=True, description="序列号列表（JSON格式，存储多个序列号）")
    
    # 需求关联（销售出库与需求关联功能增强）
    demand_id = fields.IntField(null=True, description="需求ID（关联统一需求表）")
    demand_item_id = fields.IntField(null=True, description="需求明细ID")

    # 状态
    status = fields.CharField(max_length=20, default="待出库", description="出库状态")
    delivery_time = fields.DatetimeField(null=True, description="实际出库时间")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sales_delivery_items"
        table_description = "快格轻制造 - 销售出库单明细"
        indexes = [
            ("tenant_id", "delivery_id"),
            ("material_id",),
            ("location_id",),
            ("demand_id",),  # 需求关联索引（销售出库与需求关联功能增强）
            ("demand_item_id",),
            ("batch_number",),  # 批次号索引（批号和序列号选择功能增强）
        ]
