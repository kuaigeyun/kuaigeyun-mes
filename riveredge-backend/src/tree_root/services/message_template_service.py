"""
消息模板管理服务模块

提供消息模板的 CRUD 操作。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from tree_root.models.message_template import MessageTemplate
from tree_root.schemas.message_template import MessageTemplateCreate, MessageTemplateUpdate
from soil.exceptions.exceptions import NotFoundError, ValidationError


class MessageTemplateService:
    """
    消息模板管理服务类
    
    提供消息模板的 CRUD 操作。
    """
    
    @staticmethod
    async def create_message_template(
        tenant_id: int,
        data: MessageTemplateCreate
    ) -> MessageTemplate:
        """
        创建消息模板
        
        Args:
            tenant_id: 组织ID
            data: 消息模板创建数据
            
        Returns:
            MessageTemplate: 创建的消息模板对象
            
        Raises:
            ValidationError: 当模板代码已存在时抛出
        """
        try:
            message_template = MessageTemplate(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await message_template.save()
            return message_template
        except IntegrityError:
            raise ValidationError(f"消息模板代码 {data.code} 已存在")
    
    @staticmethod
    async def get_message_template_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MessageTemplate:
        """
        根据UUID获取消息模板
        
        Args:
            tenant_id: 组织ID
            uuid: 消息模板UUID
            
        Returns:
            MessageTemplate: 消息模板对象
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplate.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not message_template:
            raise NotFoundError("消息模板不存在")
        
        return message_template
    
    @staticmethod
    async def list_message_templates(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[MessageTemplate]:
        """
        获取消息模板列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 消息类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[MessageTemplate]: 消息模板列表
        """
        query = MessageTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_message_template(
        tenant_id: int,
        uuid: str,
        data: MessageTemplateUpdate
    ) -> MessageTemplate:
        """
        更新消息模板
        
        Args:
            tenant_id: 组织ID
            uuid: 消息模板UUID
            data: 消息模板更新数据
            
        Returns:
            MessageTemplate: 更新后的消息模板对象
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplateService.get_message_template_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(message_template, key, value)
        
        await message_template.save()
        return message_template
    
    @staticmethod
    async def delete_message_template(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除消息模板（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 消息模板UUID
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplateService.get_message_template_by_uuid(tenant_id, uuid)
        message_template.deleted_at = datetime.now()
        await message_template.save()
    
    @staticmethod
    def render_template(
        template: MessageTemplate,
        variables: dict
    ) -> tuple[str, str]:
        """
        渲染消息模板
        
        Args:
            template: 消息模板对象
            variables: 模板变量值
            
        Returns:
            tuple[str, str]: (subject, content) 渲染后的主题和内容
        """
        subject = template.subject or ""
        content = template.content or ""
        
        # 简单的变量替换（使用 {variable_name} 格式）
        for key, value in variables.items():
            placeholder = f"{{{key}}}"
            subject = subject.replace(placeholder, str(value))
            content = content.replace(placeholder, str(value))
        
        return subject, content

