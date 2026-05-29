"""
销售商机模型

商机级销售漏斗：阶段挂在商机上，跟进记录关联商机并可推进阶段。
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesOpportunity(BaseModel):
    """销售商机"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    customer_id = fields.IntField(description="客户ID（主数据）")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    title = fields.CharField(max_length=200, description="商机名称")
    stage_code = fields.CharField(max_length=50, description="漏斗阶段（字典 SALES_OPPORTUNITY_STAGE）")
    status = fields.CharField(max_length=20, default="open", description="open / won / lost")

    expected_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="预计金额")
    expected_close_date = fields.DateField(null=True, description="预计成交日期")

    owner_id = fields.IntField(null=True, description="负责人（业务员）ID")

    quotation_id = fields.IntField(null=True, description="关联报价单ID")
    quotation_code = fields.CharField(max_length=50, null=True, description="关联报价单编码")
    sales_order_id = fields.IntField(null=True, description="关联销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")

    last_follow_up_at = fields.DatetimeField(null=True, description="最近跟进时间")
    next_follow_up_at = fields.DatetimeField(null=True, description="计划下次跟进时间")

    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_sales_opportunities"
        table_description = "快格轻制造 - 销售商机"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("tenant_id", "stage_code"),
            ("tenant_id", "quotation_id"),
            ("tenant_id", "sales_order_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
