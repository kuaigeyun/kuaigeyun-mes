"""平台级客户端产品（移动端 / 触屏终端 / PDA）。"""

from tortoise import fields
from tortoise.models import Model


class CoreClientProduct(Model):
    id = fields.IntField(pk=True)
    uuid = fields.CharField(max_length=36)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    client_key = fields.CharField(max_length=64, unique=True, description="全局唯一 client_key")
    display_name = fields.CharField(max_length=128)
    app_code = fields.CharField(max_length=64, null=True, description="关联 core_applications.code")
    client_kind = fields.CharField(max_length=32, description="mobile_app | touch_terminal | handheld_pda")
    platform_target = fields.CharField(max_length=16, description="android | ios | windows")
    supports_ota = fields.BooleanField(default=False)
    login_tile_slot = fields.CharField(max_length=16, default="none", description="none | windows | android")
    is_active = fields.BooleanField(default=True)
    sort_order = fields.IntField(default=0)

    push_enabled = fields.BooleanField(default=True, description="是否启用极光推送")
    jpush_app_key = fields.CharField(max_length=128, null=True)
    jpush_master_secret = fields.CharField(max_length=256, null=True)

    class Meta:
        table = "core_client_products"
