"""
售后服务工单模型

销售管理：客户售后诉求登记与闭环，可关联销售订单。
"""

from tortoise import fields
from core.models.base import BaseModel


class AfterSalesTicket(BaseModel):
    """售后服务工单"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    ticket_code = fields.CharField(max_length=50, db_index=True, description="工单编码")

    customer_id = fields.IntField(description="客户ID（主数据）")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    sales_order_id = fields.IntField(null=True, description="关联销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")
    sales_delivery_id = fields.IntField(null=True, description="关联销售出库单ID")
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="关联销售出库单编码")
    sales_return_id = fields.IntField(null=True, description="关联销售退货单ID")
    sales_return_code = fields.CharField(max_length=50, null=True, description="关联销售退货单编码")

    # 退货 / 换货 / 维修 / 索赔 / 咨询
    request_type = fields.CharField(max_length=20, description="诉求类型")
    # 待处理 / 处理中 / 已关闭
    status = fields.CharField(max_length=20, default="待处理", description="工单状态")

    content = fields.TextField(description="问题描述")
    resolution = fields.TextField(null=True, description="处理结论")

    claim_amount = fields.DecimalField(max_digits=14, decimal_places=2, null=True, description="索赔金额合计")

    registered_at = fields.DatetimeField(description="登记时间")
    closed_at = fields.DatetimeField(null=True, description="关闭时间")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_after_sales_tickets"
        table_description = "快格轻制造 - 售后服务工单"
        indexes = [
            ("tenant_id", "ticket_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("tenant_id", "registered_at"),
            ("tenant_id", "sales_order_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
