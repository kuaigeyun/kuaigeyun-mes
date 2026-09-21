"""
消息发送工作流函数。
"""

from typing import Any, Dict

from loguru import logger

from core.models.message_log import MessageLog
from core.services.messaging.message_config_service import MessageConfigService
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id
from core.utils.timezone_utils import resolve_business_datetime


@workflow_client.create_function(
    fn_id="message-sender",
    name="消息发送器",
    trigger=TriggerEvent(event="message/send"),
    retries=3,
)
@with_tenant_isolation
async def message_sender_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    message_log_uuid = data.get("message_log_uuid")
    message_type = data.get("message_type")
    recipient = data.get("recipient")
    subject = data.get("subject")
    content = data.get("content")
    config_uuid = data.get("config_uuid")

    if not message_log_uuid:
        return {"success": False, "error": "缺少必要参数：message_log_uuid"}

    message_log = await MessageLog.filter(tenant_id=tenant_id, uuid=message_log_uuid).first()
    if not message_log:
        return {"success": False, "error": f"消息记录不存在: {message_log_uuid}"}

    # 优先使用日志中已渲染的主题/正文（防止事件丢字段）
    subject = subject if subject is not None else message_log.subject
    content = content if content is not None else message_log.content
    recipient = recipient if recipient is not None else message_log.recipient
    message_type = message_type or message_log.type
    config_uuid = config_uuid or message_log.config_uuid

    message_log.status = "sending"
    message_log.sent_at = resolve_business_datetime()
    retry = int(getattr(message_log, "retry_count", 0) or 0) + 1
    if hasattr(message_log, "retry_count"):
        message_log.retry_count = retry
    await message_log.save()

    try:
        if message_type == "email":
            result = await _send_email(tenant_id, config_uuid, recipient, subject, content)
        elif message_type == "sms":
            result = await _send_sms(tenant_id, config_uuid, recipient, content)
        elif message_type == "internal":
            result = {"success": True, "message": "站内信已创建"}
        elif message_type == "push":
            result = await _send_push_notification(tenant_id, config_uuid, recipient, subject, content)
        else:
            result = {"success": False, "error": f"不支持的消息类型: {message_type}"}

        if result.get("success"):
            message_log.status = "success"
            if not message_log.sent_at:
                message_log.sent_at = resolve_business_datetime()
            message_log.error_message = None
        else:
            message_log.status = "failed"
            message_log.error_message = result.get("error", "未知错误")
        await message_log.save()
        return {
            "success": result.get("success", False),
            "message_log_uuid": message_log_uuid,
            "error": result.get("error"),
        }
    except Exception as e:
        message_log.status = "failed"
        message_log.error_message = str(e)
        await message_log.save()
        logger.error(f"消息发送失败: {message_log_uuid}, 错误: {e}")
        return {"success": False, "error": str(e)}


async def _send_email(
    tenant_id: int,
    config_uuid: str,
    recipient: str,
    subject: str,
    content: str,
) -> Dict[str, Any]:
    try:
        config = await MessageConfigService.get_message_config_by_uuid(tenant_id, config_uuid)
        if not config:
            return {"success": False, "error": "邮件配置不存在"}
        success, message, error = await MessageConfigService._send_email(
            config.config or {},
            recipient,
            subject=subject or "",
            content=content or "",
        )
        return {"success": success, "message": message, "error": error}
    except Exception as e:
        logger.error(f"发送邮件失败: {e}")
        return {"success": False, "error": str(e)}


async def _send_sms(
    tenant_id: int,
    config_uuid: str,
    recipient: str,
    content: str,
) -> Dict[str, Any]:
    """短信供应商未书面确认前禁止模拟成功（INF-04）。"""
    _ = content
    try:
        config = await MessageConfigService.get_message_config_by_uuid(tenant_id, config_uuid)
        if not config:
            return {"success": False, "error": "短信配置不存在"}
        provider = str((config.config or {}).get("provider") or "").strip()
        if not provider or provider.lower() in {"mock", "simulate", "test"}:
            logger.error(
                "短信通道未接入真实供应商，拒绝发送 tenant={} recipient={}",
                tenant_id,
                recipient,
            )
            return {
                "success": False,
                "error": "短信通道未接入真实供应商，禁止模拟成功（SMS_PROVIDER_NOT_CONFIGURED）",
            }
        # 真实供应商适配器接入前保持失败可见，不静默成功
        return {
            "success": False,
            "error": f"短信供应商 {provider} 尚未实现发送适配器",
        }
    except Exception as e:
        logger.error(f"发送短信失败: {e}")
        return {"success": False, "error": str(e)}


async def _send_push_notification(
    tenant_id: int,
    config_uuid: str,
    recipient: str,
    subject: str,
    content: str,
) -> Dict[str, Any]:
    try:
        config = await MessageConfigService.get_message_config_by_uuid(tenant_id, config_uuid)
        if not config:
            return {"success": False, "error": "推送配置不存在"}
        channel = config.config or {}
        provider = str(channel.get("provider") or channel.get("connection_type") or "").strip().lower()
        if provider in ("wecom", "wechat_work", "企业微信"):
            from core.services.messaging.wecom_message_service import send_wecom_text_message

            user_ids = [v.strip() for v in str(recipient or "").replace(",", "|").split("|") if v.strip()]
            sent = await send_wecom_text_message(
                tenant_id=tenant_id,
                user_ids=user_ids,
                content=content or subject or "",
            )
            if not sent:
                return {"success": False, "error": "企业微信未配置或无有效接收人"}
            return {"success": True, "message": "企业微信消息发送成功"}
        if provider in ("webhook", "http", "rest"):
            from infra.infrastructure.http.client import get_http_client

            url = str(channel.get("webhook_url") or channel.get("url") or "").strip()
            if not url:
                return {"success": False, "error": "推送配置缺少 webhook_url"}
            payload = {"title": subject or "新消息", "content": content or "", "recipient": recipient}
            headers = channel.get("headers") if isinstance(channel.get("headers"), dict) else None
            resp = await get_http_client().post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code >= 400:
                return {"success": False, "error": f"Webhook 返回 HTTP {resp.status_code}"}
            return {"success": True, "message": "应用 Webhook 推送成功"}
        return {"success": False, "error": "推送配置缺少 provider（wecom 或 webhook）"}
    except Exception as e:
        logger.error(f"发送推送通知失败: {e}")
        return {"success": False, "error": str(e)}
