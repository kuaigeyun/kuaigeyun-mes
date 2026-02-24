"""
销售订单明细模型

提供销售订单明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesOrderItem(BaseModel):
    """
    销售订单明细

    用于记录销售订单中每个产品的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    sales_order_id = fields.IntField(description="销售订单ID")

    # 产品信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 订单数量和价格
    order_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="订单数量")
    delivered_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="已交货数量")
    remaining_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="剩余数量")

    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, description="单价（不含税）")
    tax_rate = fields.DecimalField(max_digits=6, decimal_places=2, default=0, description="税率（%）")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="价税合计")

    # 交货信息
    delivery_date = fields.DateField(description="交货日期")
    delivery_status = fields.CharField(max_length=20, default="待交货", description="交货状态")

    # 关联工单（MTO模式）
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sales_order_items"
        table_description = "快格轻制造 - 销售订单明细"
        indexes = [
            ("tenant_id", "sales_order_id"),
            ("material_id",),
            ("work_order_id",),
            ("delivery_date",),
            ("delivery_status",),
        ]
