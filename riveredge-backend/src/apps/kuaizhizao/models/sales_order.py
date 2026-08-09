"""
销售订单模型

提供销售订单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE


class SalesOrder(BaseModel):
    """
    销售订单

    用于记录客户销售订单信息，支持MTO（Make-To-Order）模式的生产
    """
    tenant_id = fields.IntField(description="租户ID")
    order_code = fields.CharField(max_length=50, db_index=True, description="订单编码")  # 租户内未删除唯一，见迁移 462

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
    price_type = fields.CharField(max_length=20, default=DEFAULT_SALES_PRICE_TYPE, description="价格类型：含税/不含税")
    discount_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="整单优惠金额")

    # 费用信息
    fee_details = fields.JSONField(null=True, description="费用明细 (JSON)")
    total_fee_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总费用金额")

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
    currency_code = fields.CharField(max_length=20, null=True, default="CNY", description="币种（如 CNY 人民币）")

    contract_id = fields.IntField(null=True, description="关联销售合同ID")
    contract_code = fields.CharField(max_length=50, null=True, description="关联销售合同编码")
    is_release_order = fields.BooleanField(default=False, description="是否为框架合同释放单")

    # 预收款（审核通过后自动生成预收收款单）
    prepayment_amount = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="预收款金额"
    )
    prepayment_bank_account_id = fields.IntField(null=True, description="预收款银行账户ID")

    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")

    # 计划/MRP 维度：与关联 Demand 下推需求计算同进同退（不改订单主状态机）
    planning_pushed_to_computation = fields.BooleanField(
        default=False, description="计划侧已下推需求计算"
    )
    planning_computation_id = fields.IntField(null=True, description="关联需求计算ID")
    planning_computation_code = fields.CharField(max_length=50, null=True, description="关联需求计算编码")
    planning_computation_pushed_at = fields.DatetimeField(null=True, description="下推需求计算时间")

    is_active = fields.BooleanField(default=True, description="是否有效")
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
