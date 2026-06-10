"""极光推送（简易版）：按 alias 向移动端下发锁屏/通知栏消息。"""

from __future__ import annotations

import asyncio
import base64
import re
from typing import Any

import httpx
from loguru import logger

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


def _auth_header() -> str | None:
    app_key = (infra_settings.JPUSH_APP_KEY or "").strip()
    master_secret = (infra_settings.JPUSH_MASTER_SECRET or "").strip()
    if not app_key or not master_secret:
        return None
    token = base64.b64encode(f"{app_key}:{master_secret}".encode()).decode()
    return f"Basic {token}"


def push_enabled() -> bool:
    if not infra_settings.PUSH_ENABLED:
        return False
    return _auth_header() is not None


async def push_internal_message_to_user(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    message_log_uuid: str,
) -> None:
    """按 alias 推送站内信通知；失败只记日志，不抛异常。"""
    auth = _auth_header()
    if not auth:
        return

    alias = build_jpush_alias(tenant_id=tenant_id, user_id=user_id)
    title = (subject or "新消息").strip() or "新消息"
    body = _plain_text(content) or title

    payload: dict[str, Any] = {
        "platform": "android",
        "audience": {"alias": [alias]},
        "notification": {
            "alert": body,
            "android": {
                "alert": body,
                "title": title,
                "extras": {
                    "message_uuid": message_log_uuid,
                    "tenant_id": str(tenant_id),
                },
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
) -> None:
    """站内信落库后异步推送，不阻塞主流程。"""
    if not push_enabled():
        return

    async def _run() -> None:
        await push_internal_message_to_user(
            tenant_id=tenant_id,
            user_id=user_id,
            subject=subject,
            content=content,
            message_log_uuid=message_log_uuid,
        )

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run())
    except RuntimeError:
        asyncio.run(_run())
