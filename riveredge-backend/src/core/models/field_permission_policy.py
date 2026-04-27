"""字段权限策略模型（脱敏/可见性）。"""

from tortoise import fields

from core.models.base import BaseModel


class FieldMaskLevel:
    FULL = "full"
    MASKED = "masked"
    HIDDEN = "hidden"


class FieldPermissionPolicy(BaseModel):
    id = fields.IntField(pk=True, description="主键ID")
    role_uuid = fields.CharField(max_length=36, description="角色UUID")
    resource = fields.CharField(max_length=100, description="资源编码（app:resource）")
    field_name = fields.CharField(max_length=120, description="字段名")
    mask_level = fields.CharField(
        max_length=20,
        default=FieldMaskLevel.FULL,
        description="脱敏级别：full/masked/hidden",
    )
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    class Meta:
        table = "core_field_permission_policies"
        unique_together = [("tenant_id", "role_uuid", "resource", "field_name")]
        indexes = [
            ("tenant_id", "role_uuid"),
            ("tenant_id", "resource"),
            ("tenant_id", "mask_level"),
        ]
