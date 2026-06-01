"""
客户池归属流转日志。
"""

from tortoise import fields

from core.models.base import BaseModel


class CustomerPoolLog(BaseModel):
    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    customer_id = fields.IntField(description="客户ID（主数据）")
    customer_uuid = fields.CharField(max_length=64, null=True, description="客户UUID快照")
    action = fields.CharField(max_length=30, description="动作：claim/assign/release/recycle")
    from_salesman_id = fields.IntField(null=True, description="原归属业务员ID")
    to_salesman_id = fields.IntField(null=True, description="新归属业务员ID")
    operator_user_id = fields.IntField(description="操作人ID")
    reason = fields.CharField(max_length=200, null=True, description="原因")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_customer_pool_logs"
        table_description = "快格轻制造 - 客户池归属流转日志"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "action"),
            ("tenant_id", "created_at"),
        ]

