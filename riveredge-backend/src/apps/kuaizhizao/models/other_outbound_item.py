"""
其他出库单明细模型

提供其他出库单明细数据模型定义。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class OtherOutboundItem(BaseModel):
    """
    其他出库单明细

    用于记录其他出库单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    outbound_id = fields.IntField(description="出库单ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 出库数量和价格
    outbound_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="出库数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="金额")

    # 库位信息
    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    # 批次信息
    batch_number = fields.CharField(max_length=50, null=True, description="批次号")
    expiry_date = fields.DateField(null=True, description="到期日期")

    # 状态
    status = fields.CharField(max_length=20, default="待出库", description="出库状态")
    delivery_time = fields.DatetimeField(null=True, description="实际出库时间")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_other_outbound_items"
        table_description = "快格轻制造 - 其他出库单明细"
        indexes = [
            ("tenant_id", "outbound_id"),
            ("material_id",),
            ("location_id",),
        ]
