"""
销售订单收款里程碑 / 分期收款计划
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesOrderMilestone(BaseModel):
    """销售订单收款里程碑"""

    tenant_id = fields.IntField(description="租户ID")
    sales_order_id = fields.IntField(description="销售订单ID")

    milestone_name = fields.CharField(max_length=200, description="里程碑名称")
    planned_date = fields.DateField(description="计划日期")
    planned_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="计划金额")
    planned_ratio = fields.DecimalField(max_digits=8, decimal_places=4, null=True, description="计划比例 0~1")

    billing_trigger = fields.CharField(
        max_length=20,
        default="milestone",
        description="收款触发：milestone 按节点 / delivery 按发货",
    )
    is_prepayment = fields.BooleanField(
        default=False,
        description="是否预收节点（审单自动生成预收收款单；金额/账户回写订单预收字段）",
    )
    bank_account_id = fields.IntField(null=True, description="预收银行账户ID")
    status = fields.CharField(max_length=20, default="pending", description="pending / invoiced / collected / overdue")

    receivable_id = fields.IntField(null=True, description="关联应收单ID")
    receivable_code = fields.CharField(max_length=50, null=True, description="关联应收单编码")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sales_order_milestones"
        table_description = "快格轻制造 - 销售订单收款里程碑"
        indexes = [
            ("tenant_id", "sales_order_id"),
            ("planned_date",),
            ("status",),
        ]
