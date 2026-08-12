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
    notice_code = fields.CharField(max_length=50, db_index=True, description="通知单编码")  # 租户内未删除唯一，见迁移 462

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
    sales_delivery_id = fields.IntField(
        null=True,
        description="关联销售出库单ID（通知仓库时生成待出库单即回填；确认出库后通知单 status 才变为已出库）",
    )
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="销售出库单编码")
    related_sales_delivery_ids = fields.JSONField(
        null=True,
        description="关联销售出库单列表（多仓发货时 [{id, code}, ...]）",
    )

    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    is_active = fields.BooleanField(default=True, description="是否有效")
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
