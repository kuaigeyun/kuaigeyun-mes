"""
客户跟进记录模型

销售管理极简 CRM：记录沟通内容、下次跟进时间，可选关联报价单/销售订单。
"""

from tortoise import fields
from core.models.base import BaseModel


class CustomerFollowUp(BaseModel):
    """客户跟进记录"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    customer_id = fields.IntField(description="客户ID（主数据）")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    activity_type_code = fields.CharField(max_length=50, description="跟进方式（字典 SALES_FOLLOW_UP_TYPE）")
    content = fields.TextField(description="跟进内容")

    occurred_at = fields.DatetimeField(description="跟进发生时间")
    next_follow_up_at = fields.DatetimeField(null=True, description="计划下次跟进时间")

    quotation_id = fields.IntField(null=True, description="关联报价单ID")
    quotation_code = fields.CharField(max_length=50, null=True, description="关联报价单编码")
    sales_order_id = fields.IntField(null=True, description="关联销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")

    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_customer_follow_ups"
        table_description = "快格轻制造 - 客户跟进记录"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "next_follow_up_at"),
            ("tenant_id", "occurred_at"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
