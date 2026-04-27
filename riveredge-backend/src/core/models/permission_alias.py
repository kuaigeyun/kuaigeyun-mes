"""
权限别名映射模型。

用于将历史权限码映射到规范化后的主权限码，支持重复权限归并与平滑迁移。
"""

from tortoise import fields

from .base import BaseModel


class PermissionAlias(BaseModel):
    id = fields.IntField(pk=True, description="主键 ID")
    old_code = fields.CharField(max_length=100, description="旧权限码")
    canonical_code = fields.CharField(max_length=100, description="规范权限码")
    reason = fields.CharField(max_length=50, default="normalized", description="映射原因")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_permission_aliases"
        unique_together = [("tenant_id", "old_code")]
        indexes = [
            ("tenant_id", "old_code"),
            ("tenant_id", "canonical_code"),
        ]
