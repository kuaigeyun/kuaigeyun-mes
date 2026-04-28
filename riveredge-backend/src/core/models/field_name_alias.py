"""
字段名别名映射模型。

用于将外部输入字段名（source_name）统一映射到规范字段名（canonical_name）。
"""

from tortoise import fields

from .base import BaseModel


class FieldNameAlias(BaseModel):
    id = fields.IntField(pk=True, description="主键 ID")
    source_name = fields.CharField(max_length=120, description="原始字段名")
    canonical_name = fields.CharField(max_length=120, description="规范字段名")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_field_name_aliases"
        unique_together = [("tenant_id", "source_name")]
        indexes = [
            ("tenant_id", "source_name"),
            ("tenant_id", "canonical_name"),
            ("tenant_id", "is_active"),
        ]
