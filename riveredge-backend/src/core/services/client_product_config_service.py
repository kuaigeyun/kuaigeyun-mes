"""客户端产品配置（极光推送等）。"""

from __future__ import annotations

from core.config.client_product_registry import CLIENT_KEY_HAOLIGO
from core.models.client_product import CoreClientProduct
from core.services.client_release_service import ensure_default_products
from infra.config.infra_config import infra_settings
from infra.exceptions.exceptions import NotFoundError, ValidationError


def _serialize_product_config(row: CoreClientProduct) -> dict:
    env_app_key = (infra_settings.JPUSH_APP_KEY or "").strip()
    env_secret = (infra_settings.JPUSH_MASTER_SECRET or "").strip()
    db_app_key = (row.jpush_app_key or "").strip()
    db_secret = (row.jpush_master_secret or "").strip()
    push_configurable = row.platform_target == "android"

    effective_app_key = db_app_key or env_app_key
    effective_secret_configured = bool(db_secret or env_secret)

    return {
        "client_key": row.client_key,
        "display_name": row.display_name,
        "platform_target": row.platform_target,
        "push_configurable": push_configurable,
        "push_enabled": row.push_enabled,
        "header_download_enabled": bool(row.header_download_enabled),
        "jpush_app_key": db_app_key,
        "jpush_master_secret_configured": bool(db_secret),
        "effective_push_ready": bool(
            push_configurable
            and row.push_enabled
            and effective_app_key
            and effective_secret_configured
            and infra_settings.PUSH_ENABLED
        ),
        "env_fallback_app_key": bool(not db_app_key and env_app_key),
        "env_fallback_master_secret": bool(not db_secret and env_secret),
    }


async def list_client_product_configs(*, platform: str | None = None) -> list[dict]:
    await ensure_default_products()
    qs = CoreClientProduct.filter(is_active=True).order_by("sort_order", "client_key")
    if platform:
        qs = qs.filter(platform_target=platform)
    rows = await qs
    return [_serialize_product_config(row) for row in rows]


async def get_client_product_config(client_key: str) -> dict:
    await ensure_default_products()
    row = await CoreClientProduct.get_or_none(client_key=client_key, is_active=True)
    if not row:
        raise NotFoundError(f"未知客户端产品: {client_key}")

    return _serialize_product_config(row)


async def update_client_product_config(
    client_key: str,
    *,
    push_enabled: bool | None = None,
    header_download_enabled: bool | None = None,
    jpush_app_key: str | None = None,
    jpush_master_secret: str | None = None,
) -> dict:
    await ensure_default_products()
    row = await CoreClientProduct.get_or_none(client_key=client_key, is_active=True)
    if not row:
        raise NotFoundError(f"未知客户端产品: {client_key}")

    if push_enabled is not None:
        row.push_enabled = push_enabled
    if header_download_enabled is not None:
        row.header_download_enabled = header_download_enabled
    if jpush_app_key is not None:
        if row.platform_target != "android":
            raise ValidationError("仅 Android 客户端支持极光推送配置")
        key = jpush_app_key.strip()
        if not key:
            raise ValidationError("AppKey 不能为空")
        row.jpush_app_key = key
    if jpush_master_secret is not None:
        if row.platform_target != "android":
            raise ValidationError("仅 Android 客户端支持极光推送配置")
        secret = jpush_master_secret.strip()
        if secret:
            row.jpush_master_secret = secret
        else:
            row.jpush_master_secret = None

    await row.save()
    return await get_client_product_config(client_key)


async def resolve_jpush_credentials(client_key: str = CLIENT_KEY_HAOLIGO) -> tuple[str, str] | None:
    """读取推送凭据：产品配置优先，.env 兜底。"""
    if not infra_settings.PUSH_ENABLED:
        return None

    await ensure_default_products()
    row = await CoreClientProduct.get_or_none(client_key=client_key, is_active=True)
    if row and not row.push_enabled:
        return None

    app_key = ((row.jpush_app_key if row else "") or infra_settings.JPUSH_APP_KEY or "").strip()
    master_secret = (
        (row.jpush_master_secret if row else "") or infra_settings.JPUSH_MASTER_SECRET or ""
    ).strip()
    if not app_key or not master_secret:
        return None
    return app_key, master_secret
