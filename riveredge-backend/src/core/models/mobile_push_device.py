"""移动端推送设备 token（FCM 等）。"""

from tortoise import fields

from .base import BaseModel


class MobilePushDevice(BaseModel):
    """用户在某租户下注册的推送设备 token。"""

    id = fields.IntField(pk=True, description="主键")
    user_id = fields.IntField(db_index=True, description="用户 ID")
    provider = fields.CharField(max_length=20, default="fcm", description="推送通道：fcm | jpush")
    platform = fields.CharField(max_length=20, description="android | ios")
    token = fields.CharField(max_length=512, description="原生推送 token")
    device_id = fields.CharField(max_length=128, null=True, description="客户端稳定设备标识")
    is_active = fields.BooleanField(default=True, description="是否有效（注销或 FCM 失效后为 false）")
    last_seen_at = fields.DatetimeField(null=True, description="最近注册/心跳时间")

    class Meta:
        table = "core_mobile_push_device"
        unique_together = (("tenant_id", "token"),)
