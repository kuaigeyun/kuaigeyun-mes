"""
消息发送工作流函数。
"""

from datetime import datetime
from typing import Any, Dict

from loguru import logger

from core.models.message_log import MessageLog
from core.services.messaging.message_config_service import MessageConfigService
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id


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

    message_log.status = "sending"
    message_log.sent_at = datetime.now()
    await message_log.save()

    try:
        if message_type == "email":
            result = await _send_email(tenant_id, config_uuid, recipient, subject, content)
        elif message_type == "sms":
            result = await _send_sms(tenant_id, config_uuid, recipient, content)
        elif message_type == "internal":
            result = {"success": True, "message": "站内信已创建"}
        elif message_type == "push":
            result = await _send_push_notification(tenant_id, recipient, subject, content)
        else:
            result = {"success": False, "error": f"不支持的消息类型: {message_type}"}

        if result.get("success"):
            message_log.status = "success"
            if not message_log.sent_at:
                message_log.sent_at = datetime.now()
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
    _ = subject, content
    try:
        config = await MessageConfigService.get_message_config_by_uuid(tenant_id, config_uuid)
        if not config:
            return {"success": False, "error": "邮件配置不存在"}
        success, message, error = await MessageConfigService._send_test_email(config.config, recipient)
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
    _ = content
    try:
        config = await MessageConfigService.get_message_config_by_uuid(tenant_id, config_uuid)
        if not config:
            return {"success": False, "error": "短信配置不存在"}
        logger.info(f"发送短信到 {recipient}: {content}")
        return {"success": True, "message": "短信发送成功（模拟）"}
    except Exception as e:
        logger.error(f"发送短信失败: {e}")
        return {"success": False, "error": str(e)}


async def _send_push_notification(
    tenant_id: int,
    recipient: str,
    subject: str,
    content: str,
) -> Dict[str, Any]:
    _ = tenant_id, content
    try:
        logger.info(f"发送推送通知到 {recipient}: {subject}")
        return {"success": True, "message": "推送通知发送成功（模拟）"}
    except Exception as e:
        logger.error(f"发送推送通知失败: {e}")
        return {"success": False, "error": str(e)}

