"""
客户池回收规则（按租户唯一）。
"""

from tortoise import fields

from core.models.base import BaseModel


class CustomerPoolRule(BaseModel):
    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    recycle_enabled = fields.BooleanField(default=True, description="是否启用自动回收")
    recycle_after_days = fields.IntField(default=15, description="未跟进自动回收天数")
    max_owned_customers = fields.IntField(default=0, description="个人最大持有客户数（0=不限制）")
    allow_claim_others = fields.BooleanField(default=False, description="是否允许领取他人名下客户")
    updated_by = fields.IntField(null=True, description="最近更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_customer_pool_rules"
        table_description = "快格轻制造 - 客户池回收规则"
        indexes = [
            ("tenant_id",),
        ]

