"""开放 API 账套 / 应用 / 模块授权模型（入站对接凭证）。"""

from tortoise import fields

from .base import BaseModel


class OpenApiAccount(BaseModel):
    """租户级开放 API 账套（每租户一条）。"""

    id = fields.IntField(pk=True, description="主键")
    acct_id = fields.CharField(max_length=64, unique=True, description="对外账套号")
    name = fields.CharField(max_length=100, default="默认账套", description="账套名称")
    status = fields.CharField(max_length=20, default="active", description="active|disabled")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    class Meta:
        table = "core_open_api_accounts"
        table_description = "开放 API 账套"
        default_connection = "default"
        indexes = [("tenant_id",), ("acct_id",), ("status",)]


class OpenApiApp(BaseModel):
    """账套下的对接应用（一账套多应用）。"""

    id = fields.IntField(pk=True, description="主键")
    account_id = fields.IntField(description="所属账套 ID")
    app_id = fields.CharField(max_length=64, unique=True, description="对外应用 ID")
    app_secret_hash = fields.CharField(max_length=255, description="应用秘钥哈希")
    name = fields.CharField(max_length=100, description="应用名称")
    status = fields.CharField(max_length=20, default="active", description="active|disabled")
    ip_allowlist = fields.TextField(
        null=True,
        description="应用级 IP 白名单（逗号分隔，空=不限）",
    )
    expires_at = fields.DatetimeField(null=True, description="过期时间（空=不过期）")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    class Meta:
        table = "core_open_api_apps"
        table_description = "开放 API 应用"
        default_connection = "default"
        indexes = [
            ("tenant_id",),
            ("account_id",),
            ("app_id",),
            ("status",),
        ]


class OpenApiAppGrant(BaseModel):
    """应用模块授权（按权限码）。"""

    id = fields.IntField(pk=True, description="主键")
    app_pk = fields.IntField(description="OpenApiApp.id")
    permission_code = fields.CharField(max_length=128, description="权限码")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    class Meta:
        table = "core_open_api_app_grants"
        table_description = "开放 API 应用授权"
        default_connection = "default"
        unique_together = [("app_pk", "permission_code")]
        indexes = [("tenant_id",), ("app_pk",), ("permission_code",)]
