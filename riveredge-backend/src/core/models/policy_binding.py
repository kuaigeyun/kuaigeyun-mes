"""
策略绑定模型

将 ABAC 策略绑定到角色或用户主体。
"""

from tortoise import fields
from tortoise.models import Model


class PolicySubjectType:
    ROLE = "role"
    USER = "user"


class PolicyBinding(Model):
    id = fields.IntField(pk=True, description="绑定ID（主键）")
    policy_id = fields.IntField(description="策略ID")
    subject_type = fields.CharField(max_length=20, description="主体类型：role/user")
    subject_id = fields.IntField(description="主体ID（role_id 或 user_id）")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")

    class Meta:
        table = "core_policy_bindings"
        unique_together = [("policy_id", "subject_type", "subject_id")]
        indexes = [
            ("policy_id",),
            ("subject_type", "subject_id"),
        ]
