"""平台级客户端安装包 / OTA 发布记录。"""

from tortoise import fields
from tortoise.models import Model


class CoreClientRelease(Model):
    id = fields.IntField(pk=True)
    uuid = fields.CharField(max_length=36)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    client_key = fields.CharField(max_length=64, db_index=True)
    platform = fields.CharField(max_length=16, description="android | ios | windows")
    app_version = fields.CharField(max_length=32)
    version_code = fields.IntField(default=0, description="Android versionCode；Windows 可为 0")
    runtime_version = fields.CharField(max_length=64, null=True, description="Expo OTA 兼容键")

    update_type = fields.CharField(max_length=16, description="package | ota | both")
    requires_native = fields.BooleanField(default=False)
    force_update = fields.BooleanField(default=False)
    min_version_code = fields.IntField(default=0)

    release_notes = fields.TextField(default="")
    bundle_id = fields.CharField(max_length=64, null=True)

    artifact_filename = fields.CharField(max_length=256, null=True)
    artifact_sha256 = fields.CharField(max_length=64, null=True)
    artifact_size_bytes = fields.BigIntField(null=True)
    artifact_ext = fields.CharField(max_length=16, null=True, description="apk | exe | msi | zip")

    ota_relative_path = fields.CharField(max_length=512, null=True)

    rollout_percent = fields.IntField(default=100)
    is_active = fields.BooleanField(default=False)
    published_at = fields.DatetimeField(null=True)
    created_by = fields.CharField(max_length=128, null=True)

    class Meta:
        table = "core_client_releases"
        indexes = (("client_key", "platform", "is_active"), ("client_key", "version_code"))
