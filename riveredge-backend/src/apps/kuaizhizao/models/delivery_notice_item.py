"""
发货通知单明细模型

记录发货通知单中每个物料的详细信息。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class DeliveryNoticeItem(BaseModel):
    """
    发货通知单明细

    用于记录发货通知单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    notice_id = fields.IntField(description="通知单ID")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    notice_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="通知数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="金额")

    delivery_item_id = fields.IntField(null=True, description="销售出库明细ID（关联）")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_delivery_notice_items"
        table_description = "快格轻制造 - 发货通知单明细"
        indexes = [
            ("tenant_id", "notice_id"),
            ("material_id",),
            ("delivery_item_id",),
        ]
