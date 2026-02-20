"""
送货单模型

在销售出库前/后向客户发送发货通知，记录物流方式、运单号、预计送达等信息，不直接动库存。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class DeliveryNotice(BaseModel):
    """
    送货单

    用于在销售出库前/后向客户发送发货通知，记录物流信息
    """
    tenant_id = fields.IntField(description="租户ID")
    notice_code = fields.CharField(max_length=50, unique=True, description="通知单编码")

    # 关联单据
    sales_delivery_id = fields.IntField(null=True, description="销售出库单ID")
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="销售出库单编码")
    sales_order_id = fields.IntField(null=True, description="销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=50, null=True, description="客户电话")

    # 物流信息
    planned_delivery_date = fields.DateField(null=True, description="预计送达日期")
    carrier = fields.CharField(max_length=100, null=True, description="承运商/物流方式")
    tracking_number = fields.CharField(max_length=100, null=True, description="运单号")
    shipping_address = fields.TextField(null=True, description="收货地址")

    # 状态：待发送/已发送/已签收
    status = fields.CharField(max_length=20, default="待发送", description="通知状态")
    sent_at = fields.DatetimeField(null=True, description="发送时间")
    signed_at = fields.DatetimeField(null=True, description="签收时间")

    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_notices"
        table_description = "快格轻制造 - 送货单"
        indexes = [
            ("tenant_id",),
            ("notice_code",),
            ("sales_delivery_id",),
            ("sales_order_id",),
            ("customer_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]

