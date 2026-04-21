from tortoise import fields

from .base import BaseModel


class CacheEntry(BaseModel):
    id = fields.IntField(pk=True, description="缓存主键")
    namespace = fields.CharField(max_length=64, description="命名空间")
    key = fields.CharField(max_length=512, description="缓存键")
    value = fields.TextField(description="缓存值（JSON或纯文本）")
    expires_at = fields.DatetimeField(null=True, description="过期时间")

    class Meta:
        table = "core_cache_entries"
        unique_together = [("namespace", "key")]
        indexes = [
            ("namespace", "key"),
            ("expires_at",),
            ("updated_at",),
        ]
