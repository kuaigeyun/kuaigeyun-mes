"""
采购退货单明细模型

提供采购退货单明细数据模型定义。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import fields
from core.models.base import BaseModel


class PurchaseReturnItem(BaseModel):
    """
    采购退货单明细

    用于记录采购退货单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    return_id = fields.IntField(description="退货单ID")
    
    # 关联原采购入库单明细
    purchase_receipt_item_id = fields.IntField(null=True, description="采购入库单明细ID")
    
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 退货数量和价格
    return_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="退货数量")
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

    # 状态
    status = fields.CharField(max_length=20, default="待退货", description="退货状态")
    return_time = fields.DatetimeField(null=True, description="实际退货时间")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_purchase_return_items"
        table_description = "快格轻制造 - 采购退货单明细"
        indexes = [
            ("tenant_id", "return_id"),
            ("purchase_receipt_item_id",),  # 关联采购入库单明细索引
            ("material_id",),
            ("location_id",),
            ("batch_number",),
        ]
