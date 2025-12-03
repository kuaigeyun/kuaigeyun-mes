"""
消息配置管理服务模块

提供消息配置的 CRUD 操作。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from tree_root.models.message_config import MessageConfig
from tree_root.schemas.message_config import MessageConfigCreate, MessageConfigUpdate
from soil.exceptions.exceptions import NotFoundError, ValidationError


class MessageConfigService:
    """
    消息配置管理服务类
    
    提供消息配置的 CRUD 操作。
    """
    
    @staticmethod
    async def create_message_config(
        tenant_id: int,
        data: MessageConfigCreate
    ) -> MessageConfig:
        """
        创建消息配置
        
        Args:
            tenant_id: 组织ID
            data: 消息配置创建数据
            
        Returns:
            MessageConfig: 创建的消息配置对象
            
        Raises:
            ValidationError: 当配置代码已存在时抛出
        """
        try:
            message_config = MessageConfig(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await message_config.save()
            return message_config
        except IntegrityError:
            raise ValidationError(f"消息配置代码 {data.code} 已存在")
    
    @staticmethod
    async def get_message_config_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MessageConfig:
        """
        根据UUID获取消息配置
        
        Args:
            tenant_id: 组织ID
            uuid: 消息配置UUID
            
        Returns:
            MessageConfig: 消息配置对象
            
        Raises:
            NotFoundError: 当消息配置不存在时抛出
        """
        message_config = await MessageConfig.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not message_config:
            raise NotFoundError("消息配置不存在")
        
        return message_config
    
    @staticmethod
    async def list_message_configs(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[MessageConfig]:
        """
        获取消息配置列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 消息类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[MessageConfig]: 消息配置列表
        """
        query = MessageConfig.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_message_config(
        tenant_id: int,
        uuid: str,
        data: MessageConfigUpdate
    ) -> MessageConfig:
        """
        更新消息配置
        
        Args:
            tenant_id: 组织ID
            uuid: 消息配置UUID
            data: 消息配置更新数据
            
        Returns:
            MessageConfig: 更新后的消息配置对象
            
        Raises:
            NotFoundError: 当消息配置不存在时抛出
        """
        message_config = await MessageConfigService.get_message_config_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(message_config, key, value)
        
        await message_config.save()
        return message_config
    
    @staticmethod
    async def delete_message_config(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除消息配置（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 消息配置UUID
            
        Raises:
            NotFoundError: 当消息配置不存在时抛出
        """
        message_config = await MessageConfigService.get_message_config_by_uuid(tenant_id, uuid)
        message_config.deleted_at = datetime.now()
        await message_config.save()
    
    @staticmethod
    async def get_default_config(
        tenant_id: int,
        type: str
    ) -> Optional[MessageConfig]:
        """
        获取默认消息配置
        
        Args:
            tenant_id: 组织ID
            type: 消息类型
            
        Returns:
            Optional[MessageConfig]: 默认消息配置，如果不存在返回 None
        """
        return await MessageConfig.filter(
            tenant_id=tenant_id,
            type=type,
            is_default=True,
            is_active=True,
            deleted_at__isnull=True
        ).first()

