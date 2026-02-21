"""
访问策略模型（ABAC）

用于定义 RBAC 之后的属性策略（Allow / Deny）。
"""

from tortoise import fields

from .base import BaseModel


class AccessPolicyEffect:
    ALLOW = "allow"
    DENY = "deny"


class AccessPolicy(BaseModel):
    id = fields.IntField(pk=True, description="策略ID（主键）")
    name = fields.CharField(max_length=120, description="策略名称")
    effect = fields.CharField(
        max_length=10,
        default=AccessPolicyEffect.ALLOW,
        description="策略效果：allow/deny",
    )
    priority = fields.IntField(default=100, description="优先级（数值越小优先级越高）")
    target_resource = fields.CharField(max_length=100, description="目标资源，如 system.user")
    target_action = fields.CharField(max_length=50, description="目标动作，如 read/update")
    condition_expr = fields.JSONField(null=True, description="策略条件表达式（JSON）")
    enabled = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_access_policies"
        unique_together = [("tenant_id", "name")]
        indexes = [
            ("tenant_id", "enabled"),
            ("tenant_id", "target_resource", "target_action"),
            ("tenant_id", "priority"),
        ]
