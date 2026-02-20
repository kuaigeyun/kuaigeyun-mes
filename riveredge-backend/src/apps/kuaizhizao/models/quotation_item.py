"""
报价单明细模型

提供报价单明细数据模型定义。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class QuotationItem(BaseModel):
    """
    报价单明细

    用于记录报价单中每个产品的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    quotation_id = fields.IntField(description="报价单ID")

    # 产品信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 报价数量和价格
    quote_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="报价数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="金额")

    # 交货信息
    delivery_date = fields.DateField(null=True, description="预计交货日期")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_quotation_items"
        table_description = "快格轻制造 - 报价单明细"
        indexes = [
            ("tenant_id", "quotation_id"),
            ("material_id",),
        ]
