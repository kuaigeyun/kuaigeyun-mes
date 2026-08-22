"""敏感词黑名单、违规日志与组织级敏感词放行。"""

from tortoise import fields

from infra.models.base import BaseModel


class SensitiveWordViolation(BaseModel):
    """敏感词命中记录（仅敏感词控制开启的组织）。"""

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(db_index=True, description="组织 ID")
    user_id = fields.IntField(null=True, db_index=True, description="用户 ID")
    client_ip = fields.CharField(max_length=64, description="客户端 IP")
    request_path = fields.CharField(max_length=500, description="请求 API 路径")
    field_path = fields.CharField(max_length=255, description="命中字段路径")
    matched_word = fields.CharField(max_length=128, description="命中敏感词")
    content_snippet = fields.TextField(null=True, description="触发内容摘要")
    strike_count = fields.IntField(description="累计违规次数")

    class Meta:
        table = "infra_sensitive_word_violations"
        indexes = (("tenant_id", "created_at"),)


class SensitiveWordBan(BaseModel):
    """账号+IP 封禁记录。"""

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(db_index=True, description="组织 ID")
    user_id = fields.IntField(db_index=True, description="用户 ID")
    client_ip = fields.CharField(max_length=64, description="客户端 IP")
    banned_at = fields.DatetimeField(description="封禁时间")
    unbanned_at = fields.DatetimeField(null=True, description="解封时间")
    is_active = fields.BooleanField(default=True, db_index=True, description="是否仍在封禁")
    trigger_request_path = fields.CharField(max_length=500, null=True, description="触发封禁的请求路径")
    trigger_field_path = fields.CharField(max_length=255, null=True, description="触发字段")
    trigger_matched_word = fields.CharField(max_length=128, null=True, description="触发敏感词")
    trigger_content_snippet = fields.TextField(null=True, description="触发内容摘要")

    class Meta:
        table = "infra_sensitive_word_bans"
        indexes = (("tenant_id", "is_active"), ("tenant_id", "user_id", "client_ip"))


class TenantSensitiveWordAllowlist(BaseModel):
    """组织级敏感词放行（误封词单独放行）。"""

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(db_index=True, description="组织 ID")
    word = fields.CharField(max_length=128, description="放行词（规范化后存储）")
    note = fields.CharField(max_length=255, null=True, description="备注")

    class Meta:
        table = "infra_tenant_sensitive_word_allowlist"
        unique_together = (("tenant_id", "word"),)
