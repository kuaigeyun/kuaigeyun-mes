"""
权限别名模型（遗留表，鉴权不读取）。

历史权限同步曾写入 old→canonical 对照；现合并重复码只迁移角色授权并废弃旧码，
禁止在 PDP/读路径使用别名映射（见 no-fallback-patches）。
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
