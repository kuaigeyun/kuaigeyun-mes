from tortoise import fields

from .base import BaseModel


class UserActivity(BaseModel):
    id = fields.IntField(pk=True, description="用户活动主键")
    user_id = fields.IntField(description="用户ID")
    last_activity_time = fields.DatetimeField(description="最后活跃时间")
    login_ip = fields.CharField(max_length=64, null=True, description="登录IP")
    login_time = fields.DatetimeField(null=True, description="登录时间")
    expires_at = fields.DatetimeField(null=True, description="过期时间")

    class Meta:
        table = "core_user_activities"
        unique_together = [("tenant_id", "user_id")]
        indexes = [
            ("tenant_id", "user_id"),
            ("last_activity_time",),
            ("expires_at",),
        ]
