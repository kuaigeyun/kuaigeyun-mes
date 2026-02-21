"""
权限版本模型

用于权限缓存失效与版本控制。
"""

from tortoise import fields
from tortoise.models import Model


class PermissionVersion(Model):
    id = fields.IntField(pk=True, description="版本记录ID")
    tenant_id = fields.IntField(description="组织ID")
    user_id = fields.IntField(null=True, description="用户ID（为空表示租户级版本）")
    version = fields.IntField(default=1, description="权限版本号")
    updated_at = fields.DatetimeField(auto_now=True, description="更新时间")

    class Meta:
        table = "core_permission_versions"
        app = "models"
        default_connection = "default"
        unique_together = [("tenant_id", "user_id")]
        indexes = [
            ("tenant_id",),
            ("tenant_id", "user_id"),
        ]
