"""
通知服务模块

提供通知的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.notification import Notification
from apps.kuaioa.schemas.notification_schemas import (
    NotificationCreate, NotificationUpdate, NotificationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class NotificationService:
    """通知服务"""
    
    @staticmethod
    async def create_notification(
        tenant_id: int,
        data: NotificationCreate
    ) -> NotificationResponse:
        """
        创建通知
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            NotificationResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Notification.filter(
            tenant_id=tenant_id,
            notification_no=data.notification_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"通知编号 {data.notification_no} 已存在")
        
        # 创建对象
        obj = await Notification.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return NotificationResponse.model_validate(obj)
    
    @staticmethod
    async def get_notification_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> NotificationResponse:
        """
        根据UUID获取通知
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            NotificationResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Notification.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"通知 {obj_uuid} 不存在")
        
        return NotificationResponse.model_validate(obj)
    
    @staticmethod
    async def list_notifications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[NotificationResponse]:
        """
        获取通知列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[NotificationResponse]: 对象列表
        """
        query = Notification.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [NotificationResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_notification(
        tenant_id: int,
        obj_uuid: str,
        data: NotificationUpdate
    ) -> NotificationResponse:
        """
        更新通知
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            NotificationResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Notification.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"通知 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return NotificationResponse.model_validate(obj)
    
    @staticmethod
    async def delete_notification(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除通知（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Notification.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"通知 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
