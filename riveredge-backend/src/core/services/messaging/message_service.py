"""
消息发送服务模块

提供消息发送功能（基于 Inngest 事件驱动）。
"""

from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from core.models.message_log import MessageLog
from core.models.message_config import MessageConfig
from core.models.message_template import MessageTemplate
from core.schemas.message_template import SendMessageRequest, SendMessageResponse
from core.services.messaging.message_config_service import MessageConfigService
from core.services.messaging.message_template_service import MessageTemplateService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MessageService:
    """
    消息发送服务类
    
    提供消息发送功能，通过 Inngest 事件驱动。
    """
    
    @staticmethod
    async def send_message(
        tenant_id: int,
        request: SendMessageRequest
    ) -> SendMessageResponse:
        """
        发送消息
        
        通过 Inngest 事件触发消息发送。
        
        Args:
            tenant_id: 组织ID
            request: 发送消息请求
            
        Returns:
            SendMessageResponse: 发送消息响应
            
        Raises:
            NotFoundError: 当模板或配置不存在时抛出
        """
        # 获取消息模板（如果提供了 template_uuid 或 template_code）
        template: Optional[MessageTemplate] = None
        if request.template_uuid:
            template = await MessageTemplateService.get_message_template_by_uuid(
                tenant_id, str(request.template_uuid)
            )
        elif request.template_code:
            template = await MessageTemplateService.get_message_template_by_code(
                tenant_id, str(request.template_code)
            )
            
        if template:
            # 渲染模板
            variables = request.variables or {}
            subject, content = MessageTemplateService.render_template(template, variables)
        else:
            subject = request.subject
            content = request.content
            if not content:
                raise ValidationError("消息内容不能为空（未提供模板时）")
        
        # 获取消息配置（如果提供了 config_uuid，否则使用默认配置）
        config: Optional[MessageConfig] = None
        if request.config_uuid:
            config = await MessageConfigService.get_message_config_by_uuid(
                tenant_id, str(request.config_uuid)
            )
        else:
            config = await MessageConfigService.get_default_config(tenant_id, request.type)
        
        if not config:
            raise ValidationError(f"未找到 {request.type} 类型的消息配置")
        
        # 创建消息发送记录
        message_log = await MessageLog.create(
            tenant_id=tenant_id,
            template_uuid=str(template.uuid) if template else None,
            config_uuid=str(config.uuid),
            type=request.type,
            recipient=request.recipient,
            subject=subject,
            content=content,
            variables=request.variables,
            status="pending",
        )
        
        # 发送 Inngest 事件触发消息发送
        from core.inngest.client import inngest_client
        from inngest import Event
        
        try:
            # 发送 Inngest 事件
            event_response = await inngest_client.send(
                Event(
                    name="message/send",
                    data={
                        "tenant_id": tenant_id,
                        "message_log_uuid": str(message_log.uuid),
                        "message_type": request.type,
                        "recipient": request.recipient,
                        "subject": subject,
                        "content": content,
                        "config_uuid": str(config.uuid),
                    }
                )
            )
            
            # 从 Inngest 响应中获取 run_id（send 返回 list[str] 事件 ID 列表）
            inngest_run_id = event_response[0] if isinstance(event_response, list) and event_response else None
            
            # 更新消息日志的 Inngest run_id
            if inngest_run_id:
                message_log.inngest_run_id = inngest_run_id
                await message_log.save()
            
            return SendMessageResponse(
                success=True,
                message_log_uuid=message_log.uuid,
                inngest_run_id=inngest_run_id,
            )
        except Exception as e:
            # 如果 Inngest 事件发送失败，记录错误但保持消息日志为 pending 状态
            # 这样可以通过重试机制重新发送
            message_log.status = "pending"
            message_log.error_message = f"Inngest 事件发送失败: {str(e)}"
            await message_log.save()
            
            # 记录错误日志
            from loguru import logger
            logger.error(f"发送 Inngest 事件失败: {e}")
            
            return SendMessageResponse(
                success=False,
                message_log_uuid=message_log.uuid,
                inngest_run_id=None,
            )
    
    @staticmethod
    async def list_message_logs(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        status: Optional[str] = None
    ) -> list[MessageLog]:
        """
        获取消息发送记录列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 消息类型筛选
            status: 发送状态筛选
            
        Returns:
            list[MessageLog]: 消息发送记录列表
        """
        query = MessageLog.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if status:
            query = query.filter(status=status)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()

