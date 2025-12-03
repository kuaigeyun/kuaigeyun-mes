"""
消息发送服务模块

提供消息发送功能（基于 Inngest 事件驱动）。
"""

from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from tree_root.models.message_log import MessageLog
from tree_root.models.message_config import MessageConfig
from tree_root.models.message_template import MessageTemplate
from tree_root.schemas.message_template import SendMessageRequest, SendMessageResponse
from tree_root.services.message_config_service import MessageConfigService
from tree_root.services.message_template_service import MessageTemplateService
from soil.exceptions.exceptions import NotFoundError, ValidationError


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
        # 获取消息模板（如果提供了 template_uuid）
        template: Optional[MessageTemplate] = None
        if request.template_uuid:
            template = await MessageTemplateService.get_message_template_by_uuid(
                tenant_id, str(request.template_uuid)
            )
            
            # 渲染模板
            variables = request.variables or {}
            subject, content = MessageTemplateService.render_template(template, variables)
        else:
            subject = request.subject
            content = request.content
        
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
            template_uuid=str(request.template_uuid) if request.template_uuid else None,
            config_uuid=str(config.uuid),
            type=request.type,
            recipient=request.recipient,
            subject=subject,
            content=content,
            variables=request.variables,
            status="pending",
        )
        
        # TODO: 集成 Inngest 事件驱动
        # 发送 Inngest 事件触发消息发送
        # from tree_root.inngest.client import inngest_client
        # from inngest import Event
        # 
        # await inngest_client.send_event(
        #     event=Event(
        #         name="message/send",
        #         data={
        #             "tenant_id": tenant_id,
        #             "message_log_uuid": str(message_log.uuid),
        #             "message_type": request.type,
        #             "recipient": request.recipient,
        #             "subject": subject,
        #             "content": content,
        #             "config_uuid": str(config.uuid),
        #         }
        #     )
        # )
        
        # 临时实现：直接标记为成功（等待 Inngest 集成后改为异步处理）
        message_log.status = "sending"
        message_log.sent_at = datetime.now()
        await message_log.save()
        
        return SendMessageResponse(
            success=True,
            message_log_uuid=message_log.uuid,
            inngest_run_id=None,  # TODO: 从 Inngest 响应中获取
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

