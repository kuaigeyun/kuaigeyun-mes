"""用户移动端 FCM token 注册与查询。"""

from __future__ import annotations

from datetime import datetime, timezone

from core.models.mobile_push_device import MobilePushDevice


async def register_mobile_push_device(
    *,
    tenant_id: int,
    user_id: int,
    token: str,
    platform: str,
    provider: str = "fcm",
    device_id: str | None = None,
) -> MobilePushDevice:
    now = datetime.now(timezone.utc)
    normalized_token = token.strip()
    normalized_platform = platform.strip().lower() or "android"
    normalized_provider = provider.strip().lower() or "fcm"
    normalized_device_id = (device_id or "").strip() or None

    row, created = await MobilePushDevice.get_or_create(
        tenant_id=tenant_id,
        token=normalized_token,
        defaults={
            "user_id": user_id,
            "provider": normalized_provider,
            "platform": normalized_platform,
            "device_id": normalized_device_id,
            "is_active": True,
            "last_seen_at": now,
        },
    )
    if not created:
        row.user_id = user_id
        row.provider = normalized_provider
        row.platform = normalized_platform
        row.device_id = normalized_device_id
        row.is_active = True
        row.last_seen_at = now
        await row.save()
    return row


async def unregister_mobile_push_device(
    *,
    tenant_id: int,
    user_id: int,
    token: str,
) -> None:
    normalized_token = token.strip()
    if not normalized_token:
        return
    await MobilePushDevice.filter(
        tenant_id=tenant_id,
        user_id=user_id,
        token=normalized_token,
    ).update(is_active=False)


async def list_active_fcm_tokens(*, tenant_id: int, user_id: int) -> list[str]:
    rows = await MobilePushDevice.filter(
        tenant_id=tenant_id,
        user_id=user_id,
        provider="fcm",
        is_active=True,
    ).values_list("token", flat=True)
    return [str(t).strip() for t in rows if str(t).strip()]


async def deactivate_fcm_token(*, tenant_id: int, token: str) -> None:
    normalized_token = token.strip()
    if not normalized_token:
        return
    await MobilePushDevice.filter(
        tenant_id=tenant_id,
        token=normalized_token,
        provider="fcm",
    ).update(is_active=False)
