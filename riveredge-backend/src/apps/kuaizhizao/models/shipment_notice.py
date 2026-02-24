"""
发货通知单模型

销售通知仓库发货，不直接动库存。来源为销售订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

from tortoise import fields
from core.models.base import BaseModel


class ShipmentNotice(BaseModel):
    """
    发货通知单

    销售创建，通知仓库发货；不直接动库存。
    """
    tenant_id = fields.IntField(description="租户ID")
    notice_code = fields.CharField(max_length=50, unique=True, description="通知单编码")

    # 关联单据
    sales_order_id = fields.IntField(description="销售订单ID")
    sales_order_code = fields.CharField(max_length=50, description="销售订单编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=50, null=True, description="客户电话")

    # 出库仓库
    warehouse_id = fields.IntField(null=True, description="出库仓库ID")
    warehouse_name = fields.CharField(max_length=100, null=True, description="出库仓库名称")

    # 计划发货日期
    planned_ship_date = fields.DateField(null=True, description="计划发货日期")
    shipping_address = fields.TextField(null=True, description="收货地址")

    # 状态：待发货/已通知/已出库
    status = fields.CharField(max_length=20, default="待发货", description="通知状态")
    notified_at = fields.DatetimeField(null=True, description="通知仓库时间")
    sales_delivery_id = fields.IntField(null=True, description="销售出库单ID（已出库时关联）")
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="销售出库单编码")

    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_shipment_notices"
        table_description = "快格轻制造 - 发货通知单"
        indexes = [
            ("tenant_id",),
            ("notice_code",),
            ("sales_order_id",),
            ("customer_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
