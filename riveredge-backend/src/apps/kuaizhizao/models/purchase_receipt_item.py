"""
采购入库单明细模型

提供采购入库单明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class PurchaseReceiptItem(BaseModel):
    """
    采购入库单明细

    用于记录采购入库单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    receipt_id = fields.IntField(description="入库单ID")

    # 采购订单明细关联
    purchase_order_item_id = fields.IntField(description="采购订单明细ID")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 入库数量和价格
    receipt_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="入库数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="金额")

    # 质量信息
    qualified_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="不合格数量")
    quality_status = fields.CharField(max_length=20, default="合格", description="质量状态")

    # 库位信息
    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    # 批次信息
    batch_number = fields.CharField(max_length=50, null=True, description="批次号")
    expiry_date = fields.DateField(null=True, description="到期日期")
    manufacturing_date = fields.DateField(null=True, description="生产日期")

    # 状态
    status = fields.CharField(max_length=20, default="待入库", description="入库状态")
    receipt_time = fields.DatetimeField(null=True, description="实际入库时间")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_purchase_receipt_items"
        table_description = "快格轻制造 - 采购入库单明细"
        indexes = [
            ("tenant_id", "receipt_id"),
            ("material_id",),
            ("location_id",),
        ]
