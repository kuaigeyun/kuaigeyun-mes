"""
销售退货单模型

提供销售退货单数据模型定义。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesReturn(BaseModel):
    """
    销售退货单

    用于记录销售退货的详细信息，关联到销售出库单
    """
    tenant_id = fields.IntField(description="租户ID")
    return_code = fields.CharField(max_length=50, unique=True, description="退货单编码")

    # 销售出库单信息（关联原出库单）
    sales_delivery_id = fields.IntField(null=True, description="销售出库单ID")
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="销售出库单编码")
    
    # 销售订单信息（用于追溯）
    sales_order_id = fields.IntField(null=True, description="销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码")
    
    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")

    # 退货信息
    warehouse_id = fields.IntField(description="退货入库仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="退货入库仓库名称")
    return_time = fields.DatetimeField(null=True, description="实际退货时间")

    # 退货人信息
    returner_id = fields.IntField(null=True, description="退货人ID")
    returner_name = fields.CharField(max_length=100, null=True, description="退货人姓名")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 退货原因
    return_reason = fields.CharField(max_length=200, null=True, description="退货原因")
    return_type = fields.CharField(max_length=20, default="质量问题", description="退货类型（质量问题/客户取消/其他）")

    status = fields.CharField(max_length=20, default="待退货", description="退货状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总退货数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    # 物流信息
    shipping_method = fields.CharField(max_length=50, null=True, description="退货方式")
    tracking_number = fields.CharField(max_length=100, null=True, description="物流单号")
    shipping_address = fields.TextField(null=True, description="退货地址")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_returns"
        table_description = "快格轻制造 - 销售退货单"
        indexes = [
            ("tenant_id",),
            ("return_code",),
            ("sales_delivery_id",),  # 关联销售出库单索引
            ("sales_order_id",),
            ("customer_id",),
            ("warehouse_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
