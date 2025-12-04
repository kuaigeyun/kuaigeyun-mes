"""
消息发送 Inngest 工作流函数

处理消息发送工作流，支持邮件、短信、站内信、推送通知等消息类型。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from datetime import datetime
import httpx
from loguru import logger

from core.inngest.client import inngest_client
from core.models.message_log import MessageLog
from core.models.message_config import MessageConfig
from core.services.message_config_service import MessageConfigService


@inngest_client.create_function(
    fn_id="message-sender",
    name="消息发送器",
    trigger=TriggerEvent(event="message/send"),
    retries=3,
)
async def message_sender_function(event: Event) -> Dict[str, Any]:
    """
    消息发送器工作流函数
    
    监听 message/send 事件，根据消息类型发送消息。
    支持邮件、短信、站内信、推送通知等消息类型。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 发送结果
    """
    data = event.data or {}
    tenant_id = data.get("tenant_id")
    message_log_uuid = data.get("message_log_uuid")
    message_type = data.get("message_type")
    recipient = data.get("recipient")
    subject = data.get("subject")
    content = data.get("content")
    config_uuid = data.get("config_uuid")
    
    if not tenant_id or not message_log_uuid:
        return {
            "success": False,
            "error": "缺少必要参数：tenant_id 或 message_log_uuid"
        }
    
    # 获取消息日志记录
    message_log = await MessageLog.filter(
        tenant_id=tenant_id,
        uuid=message_log_uuid
    ).first()
    
    if not message_log:
        return {
            "success": False,
            "error": f"消息记录不存在: {message_log_uuid}"
        }
    
    # 更新状态为发送中
    message_log.status = "sending"
    message_log.sent_at = datetime.now()
    await message_log.save()
    
    try:
        # 根据消息类型发送消息
        if message_type == "email":
            result = await _send_email(tenant_id, config_uuid, recipient, subject, content)
        elif message_type == "sms":
            result = await _send_sms(tenant_id, config_uuid, recipient, content)
        elif message_type == "internal":
            # 站内信已经在创建 MessageLog 时完成，只需要标记为成功
            result = {"success": True, "message": "站内信已创建"}
        elif message_type == "push":
            result = await _send_push_notification(tenant_id, recipient, subject, content)
        else:
            result = {"success": False, "error": f"不支持的消息类型: {message_type}"}
        
        # 更新消息日志状态
        if result.get("success"):
            message_log.status = "success"
            # completed_at 字段不存在，使用 sent_at 表示完成时间
            if not message_log.sent_at:
                message_log.sent_at = datetime.now()
        else:
            message_log.status = "failed"
            message_log.error_message = result.get("error", "未知错误")
        
        await message_log.save()
        
        return {
            "success": result.get("success", False),
            "message_log_uuid": message_log_uuid,
            "error": result.get("error")
        }
    except Exception as e:
        # 更新消息日志状态为失败
        message_log.status = "failed"
        message_log.error_message = str(e)
        await message_log.save()
        
        logger.error(f"消息发送失败: {message_log_uuid}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def _send_email(
    tenant_id: int,
    config_uuid: str,
    recipient: str,
    subject: str,
    content: str
) -> Dict[str, Any]:
    """
    发送邮件
    
    Args:
        tenant_id: 组织ID
        config_uuid: 消息配置UUID
        recipient: 收件人邮箱
        subject: 邮件主题
        content: 邮件内容
        
    Returns:
        Dict[str, Any]: 发送结果
    """
    try:
        # 获取邮件配置
        config = await MessageConfigService.get_message_config_by_uuid(
            tenant_id, config_uuid
        )
        
        if not config:
            return {"success": False, "error": "邮件配置不存在"}
        
        # TODO: 根据配置类型调用相应的邮件发送服务
        # 目前先使用简单的 HTTP 请求模拟（实际应该调用邮件服务插件）
        # 例如：SMTP、SendGrid、阿里云邮件等
        
        # 临时实现：标记为成功（等待邮件服务插件实现）
        logger.info(f"发送邮件到 {recipient}: {subject}")
        
        return {
            "success": True,
            "message": "邮件发送成功（模拟）"
        }
    except Exception as e:
        logger.error(f"发送邮件失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def _send_sms(
    tenant_id: int,
    config_uuid: str,
    recipient: str,
    content: str
) -> Dict[str, Any]:
    """
    发送短信
    
    Args:
        tenant_id: 组织ID
        config_uuid: 消息配置UUID
        recipient: 收件人手机号
        content: 短信内容
        
    Returns:
        Dict[str, Any]: 发送结果
    """
    try:
        # 获取短信配置
        config = await MessageConfigService.get_message_config_by_uuid(
            tenant_id, config_uuid
        )
        
        if not config:
            return {"success": False, "error": "短信配置不存在"}
        
        # TODO: 根据配置类型调用相应的短信发送服务
        # 目前先使用简单的 HTTP 请求模拟（实际应该调用短信服务插件）
        # 例如：阿里云短信、腾讯云短信、华为云短信等
        
        # 临时实现：标记为成功（等待短信服务插件实现）
        logger.info(f"发送短信到 {recipient}: {content}")
        
        return {
            "success": True,
            "message": "短信发送成功（模拟）"
        }
    except Exception as e:
        logger.error(f"发送短信失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def _send_push_notification(
    tenant_id: int,
    recipient: str,
    subject: str,
    content: str
) -> Dict[str, Any]:
    """
    发送推送通知
    
    Args:
        tenant_id: 组织ID
        recipient: 收件人（用户ID或设备ID）
        subject: 通知标题
        content: 通知内容
        
    Returns:
        Dict[str, Any]: 发送结果
    """
    try:
        # TODO: 实现推送通知发送逻辑
        # 例如：WebSocket 推送、Firebase Cloud Messaging、极光推送等
        
        # 临时实现：标记为成功（等待推送服务实现）
        logger.info(f"发送推送通知到 {recipient}: {subject}")
        
        return {
            "success": True,
            "message": "推送通知发送成功（模拟）"
        }
    except Exception as e:
        logger.error(f"发送推送通知失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }

