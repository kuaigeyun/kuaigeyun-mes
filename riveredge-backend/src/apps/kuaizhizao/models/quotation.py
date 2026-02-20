"""
报价单模型

提供报价单数据模型定义，销售前报价，可转销售订单。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class Quotation(BaseModel):
    """
    报价单

    用于记录销售前报价信息，结构与销售订单类似，可转销售订单
    """
    tenant_id = fields.IntField(description="租户ID")
    quotation_code = fields.CharField(max_length=50, unique=True, description="报价单编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=20, null=True, description="客户电话")

    # 报价基本信息
    quotation_date = fields.DateField(description="报价日期")
    valid_until = fields.DateField(null=True, description="有效期至")
    delivery_date = fields.DateField(null=True, description="预计交货日期")

    # 金额信息
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    # 状态：草稿/已发送/已接受/已拒绝/已转订单
    status = fields.CharField(max_length=20, default="草稿", description="报价状态")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 销售信息
    salesman_id = fields.IntField(null=True, description="销售员ID")
    salesman_name = fields.CharField(max_length=100, null=True, description="销售员姓名")

    # 物流信息
    shipping_address = fields.TextField(null=True, description="收货地址")
    shipping_method = fields.CharField(max_length=50, null=True, description="发货方式")
    payment_terms = fields.CharField(max_length=100, null=True, description="付款条件")

    # 转订单后关联
    sales_order_id = fields.IntField(null=True, description="关联销售订单ID（转订单后）")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_quotations"
        table_description = "快格轻制造 - 报价单"
        indexes = [
            ("tenant_id",),
            ("quotation_code",),
            ("customer_id",),
            ("status",),
            ("quotation_date",),
            ("sales_order_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
