"""
消息发送服务模块

提供消息发送功能（基于 Taskiq 异步任务，PostgreSQL 队列）。
"""

from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from tortoise import timezone

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
    
    提供消息发送功能，通过 Taskiq 投递 message/send 任务。
    """
    
    @staticmethod
    async def send_message(
        tenant_id: int,
        request: SendMessageRequest
    ) -> SendMessageResponse:
        """
        发送消息
        
        通过 Taskiq 任务触发消息发送。
        
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
        elif request.type == "internal":
            config = await MessageConfigService.ensure_default_internal_config(tenant_id)
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

        # 站内信无需外部通道，同步标记成功即可（不依赖 Taskiq worker）
        if request.type == "internal":
            message_log.status = "success"
            message_log.sent_at = timezone.now()
            await message_log.save()
            return SendMessageResponse(
                success=True,
                message_log_uuid=message_log.uuid,
                inngest_run_id=None,
            )
        
        from core.tasks.dispatcher import TaskEvent, dispatch_event

        try:
            event_response = await dispatch_event(
                TaskEvent(
                    name="message/send",
                    data={
                        "tenant_id": tenant_id,
                        "message_log_uuid": str(message_log.uuid),
                        "message_type": request.type,
                        "recipient": request.recipient,
                        "subject": subject,
                        "content": content,
                        "config_uuid": str(config.uuid),
                    },
                )
            )

            inngest_run_id = event_response[0] if isinstance(event_response, list) and event_response else None
            
            # 更新消息日志的异步任务 id（历史字段 inngest_run_id）
            if inngest_run_id:
                message_log.inngest_run_id = inngest_run_id
                await message_log.save()
            
            return SendMessageResponse(
                success=True,
                message_log_uuid=message_log.uuid,
                inngest_run_id=inngest_run_id,
            )
        except Exception as e:
            message_log.status = "pending"
            message_log.error_message = f"异步消息任务投递失败: {str(e)}"
            await message_log.save()
            
            # 记录错误日志
            from loguru import logger
            logger.error(f"投递 message/send 任务失败: {e}")
            
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

