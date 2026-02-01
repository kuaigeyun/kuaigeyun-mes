"""
销售订单模型

提供销售订单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus


class SalesOrder(BaseModel):
    """
    销售订单

    用于记录客户销售订单信息，支持MTO（Make-To-Order）模式的生产
    """
    tenant_id = fields.IntField(description="租户ID")
    order_code = fields.CharField(max_length=50, unique=True, description="订单编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=20, null=True, description="客户电话")

    # 订单基本信息
    order_date = fields.DateField(description="订单日期")
    delivery_date = fields.DateField(description="交货日期")
    order_type = fields.CharField(max_length=20, default="MTO", description="订单类型")

    # 金额信息
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    # 状态
    status = fields.CharField(max_length=20, default=DemandStatus.DRAFT, description="订单状态")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default=ReviewStatus.PENDING, description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 销售信息
    salesman_id = fields.IntField(null=True, description="销售员ID")
    salesman_name = fields.CharField(max_length=100, null=True, description="销售员姓名")

    # 物流信息
    shipping_address = fields.TextField(null=True, description="收货地址")
    shipping_method = fields.CharField(max_length=50, null=True, description="发货方式")
    payment_terms = fields.CharField(max_length=100, null=True, description="付款条件")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_orders"
        table_description = "快格轻制造 - 销售订单"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("order_date",),
            ("delivery_date",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
