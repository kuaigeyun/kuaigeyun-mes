"""审批站内信配套的企微应用消息（走消息配置 push + provider=wecom）。"""

from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import quote

from loguru import logger

from core.models.message_config import MessageConfig
from core.schemas.message_template import SendMessageRequest
from core.services.messaging.message_config_service import MessageConfigService
from core.services.messaging.message_service import MessageService
from infra.config.infra_config import infra_settings
from infra.models.tenant import Tenant

_WECOM_PROVIDERS = frozenset({"wecom", "wechat_work", "企业微信"})


def _config_provider_wecom(config: MessageConfig | None) -> bool:
    if not config:
        return False
    raw = config.config if isinstance(config.config, dict) else {}
    provider = str(raw.get("provider") or raw.get("connection_type") or "").strip().lower()
    return provider in _WECOM_PROVIDERS


async def resolve_active_wecom_push_config(tenant_id: int) -> MessageConfig | None:
    """默认 push 为企微时优先；否则取最近更新的启用企微 push 配置。"""
    default_push = await MessageConfigService.get_default_config(tenant_id, "push")
    if _config_provider_wecom(default_push):
        return default_push

    rows = await MessageConfig.filter(
        tenant_id=tenant_id,
        type="push",
        is_active=True,
        deleted_at__isnull=True,
    ).order_by("-is_default", "-updated_at")
    for row in rows:
        if _config_provider_wecom(row):
            return row
    return None


async def ensure_approval_document_url(
    tenant_id: int,
    variables: dict[str, Any],
) -> None:
    """为企微卡片生成 PC 打开链接（组织入口 + redirect）。"""
    if str(variables.get("document_url") or "").strip():
        return

    origin = (infra_settings.BASE_URL or "").strip().rstrip("/")
    if not origin:
        return

    tenant = await Tenant.get_or_none(id=tenant_id)
    if not tenant:
        return
    domain = (tenant.domain or "").strip().lower()
    if not domain:
        return

    detail_path = str(variables.get("detail_path") or "/personal/tasks").strip()
    if not detail_path.startswith("/"):
        detail_path = f"/{detail_path}"

    variables["document_url"] = f"{origin}/{domain}?redirect={quote(detail_path)}"


async def send_approval_wecom_push(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    variables: dict[str, Any] | None,
    trigger_action: str | None = None,
) -> None:
    """向审批收件人发送企微应用消息；无配置或未绑定 userid 时仅记日志。"""
    push_config = await resolve_active_wecom_push_config(tenant_id)
    if not push_config:
        logger.debug("审批企微推送跳过：租户 {} 无启用的企微 push 配置", tenant_id)
        return

    vars_payload = dict(variables or {})
    vars_payload.setdefault("message_category", "approval")
    await ensure_approval_document_url(tenant_id, vars_payload)

    body = (content or subject or "").strip()
    if not body:
        return

    result = await MessageService.send_message(
        tenant_id,
        SendMessageRequest(
            type="push",
            config_uuid=push_config.uuid,
            recipient=str(user_id),
            subject=(subject or "待审批").strip()[:200],
            content=body,
            variables=vars_payload,
            business_document="approval",
            business_action=(trigger_action or vars_payload.get("trigger_action") or "pending"),
        ),
    )
    if not result.success:
        logger.warning(
            "审批企微推送失败 tenant={} user={} err={}",
            tenant_id,
            user_id,
            result.error,
        )


def schedule_approval_wecom_push(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    variables: dict[str, Any] | None,
    trigger_action: str | None = None,
) -> None:
    """异步派发，不阻塞审批主链路。"""

    async def _run() -> None:
        try:
            await send_approval_wecom_push(
                tenant_id=tenant_id,
                user_id=user_id,
                subject=subject,
                content=content,
                variables=variables,
                trigger_action=trigger_action,
            )
        except Exception as exc:
            logger.warning(
                "审批企微推送异常 tenant={} user={}: {}",
                tenant_id,
                user_id,
                exc,
            )

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run())
    except RuntimeError:
        asyncio.run(_run())
