"""极光推送（简易版）：按 alias 向移动端下发锁屏/通知栏消息。"""

from __future__ import annotations

import asyncio
import base64
import re
from typing import Any

import httpx
from loguru import logger

from core.config.client_product_registry import CLIENT_KEY_HAOLIGO
from infra.config.infra_config import infra_settings

_JPUSH_PUSH_URL = "https://api.jpush.cn/v3/push"
_TAG_RE = re.compile(r"<[^>]+>")


def build_jpush_alias(*, tenant_id: int, user_id: int) -> str:
    return f"{tenant_id}_{user_id}"


def _plain_text(raw: str, *, limit: int = 120) -> str:
    text = _TAG_RE.sub("", raw or "").replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def _auth_header_from_credentials(app_key: str, master_secret: str) -> str:
    token = base64.b64encode(f"{app_key}:{master_secret}".encode()).decode()
    return f"Basic {token}"


def push_enabled() -> bool:
    if not infra_settings.PUSH_ENABLED:
        return False
    app_key = (infra_settings.JPUSH_APP_KEY or "").strip()
    master_secret = (infra_settings.JPUSH_MASTER_SECRET or "").strip()
    return bool(app_key and master_secret)


async def push_enabled_for_client(client_key: str = CLIENT_KEY_HAOLIGO) -> bool:
    from core.services.client_product_config_service import resolve_jpush_credentials

    if not infra_settings.PUSH_ENABLED:
        return False
    return (await resolve_jpush_credentials(client_key)) is not None


_PUSH_EXTRA_KEYS = (
    "trigger_document",
    "trigger_action",
    "detail_path",
    "sheet_no",
    "trial_sheet_id",
    "mold_maintenance_sheet_id",
    "mold_maintenance_complete_sheet_id",
    "outsource_maintenance_sheet_id",
    "outsource_complete_sheet_id",
    "equipment_upkeep_sheet_id",
    "equipment_upkeep_complete_sheet_id",
    "spot_check_id",
    "route_patrol_id",
    "hazard_id",
    "service_type",
)


def _resolve_route_kind(*, subject: str, variables: dict[str, Any] | None) -> str:
    action = str((variables or {}).get("trigger_action") or "").strip().lower()
    if action in {"submitted"}:
        return "approval"
    subj = (subject or "").strip()
    if "待审" in subj or "待审核" in subj:
        return "approval"
    return "message"


def _build_push_extras(
    *,
    tenant_id: int,
    message_log_uuid: str,
    subject: str,
    variables: dict[str, Any] | None,
) -> dict[str, str]:
    extras: dict[str, str] = {
        "message_uuid": message_log_uuid,
        "tenant_id": str(tenant_id),
        "route_kind": _resolve_route_kind(subject=subject, variables=variables),
    }
    for key, value in (variables or {}).items():
        if value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        if key in _PUSH_EXTRA_KEYS or key.endswith("_id"):
            extras[key] = text
    return extras


async def push_internal_message_to_user(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    message_log_uuid: str,
    variables: dict[str, Any] | None = None,
) -> None:
    """按 alias 推送站内信通知；失败只记日志，不抛异常。"""
    from core.services.client_product_config_service import resolve_jpush_credentials

    creds = await resolve_jpush_credentials(CLIENT_KEY_HAOLIGO)
    if not creds:
        return
    app_key, master_secret = creds
    auth = _auth_header_from_credentials(app_key, master_secret)

    alias = build_jpush_alias(tenant_id=tenant_id, user_id=user_id)
    title = (subject or "新消息").strip() or "新消息"
    body = _plain_text(content) or title
    extras = _build_push_extras(
        tenant_id=tenant_id,
        message_log_uuid=message_log_uuid,
        subject=title,
        variables=variables,
    )

    payload: dict[str, Any] = {
        "platform": "android",
        "audience": {"alias": [alias]},
        "notification": {
            "alert": body,
            "android": {
                "alert": body,
                "title": title,
                "extras": extras,
            },
        },
        "options": {
            "apns_production": False,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                _JPUSH_PUSH_URL,
                json=payload,
                headers={
                    "Authorization": auth,
                    "Content-Type": "application/json",
                },
            )
        if response.status_code != 200:
            logger.warning(
                "极光推送失败 alias={} status={} body={}",
                alias,
                response.status_code,
                response.text[:500],
            )
            return
        logger.debug("极光推送成功 alias={} msg={}", alias, message_log_uuid)
    except Exception as exc:
        logger.warning("极光推送异常 alias={}: {}", alias, exc)


def schedule_internal_message_push(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    message_log_uuid: str,
    variables: dict[str, Any] | None = None,
) -> None:
    """站内信落库后异步推送，不阻塞主流程。"""
    if not infra_settings.PUSH_ENABLED:
        return

    async def _run() -> None:
        from core.services.client_product_config_service import push_enabled_for_client

        if not await push_enabled_for_client(CLIENT_KEY_HAOLIGO):
            return
        await push_internal_message_to_user(
            tenant_id=tenant_id,
            user_id=user_id,
            subject=subject,
            content=content,
            message_log_uuid=message_log_uuid,
            variables=variables,
        )

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run())
    except RuntimeError:
        asyncio.run(_run())
