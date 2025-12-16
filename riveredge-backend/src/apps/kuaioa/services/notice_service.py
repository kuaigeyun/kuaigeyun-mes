"""
公告服务模块

提供公告的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.notice import Notice
from apps.kuaioa.schemas.notice_schemas import (
    NoticeCreate, NoticeUpdate, NoticeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class NoticeService:
    """公告服务"""
    
    @staticmethod
    async def create_notice(
        tenant_id: int,
        data: NoticeCreate
    ) -> NoticeResponse:
        """
        创建公告
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            NoticeResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Notice.filter(
            tenant_id=tenant_id,
            notice_no=data.notice_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"公告编号 {data.notice_no} 已存在")
        
        # 创建对象
        obj = await Notice.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return NoticeResponse.model_validate(obj)
    
    @staticmethod
    async def get_notice_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> NoticeResponse:
        """
        根据UUID获取公告
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            NoticeResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Notice.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"公告 {obj_uuid} 不存在")
        
        return NoticeResponse.model_validate(obj)
    
    @staticmethod
    async def list_notices(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[NoticeResponse]:
        """
        获取公告列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[NoticeResponse]: 对象列表
        """
        query = Notice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [NoticeResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_notice(
        tenant_id: int,
        obj_uuid: str,
        data: NoticeUpdate
    ) -> NoticeResponse:
        """
        更新公告
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            NoticeResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Notice.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"公告 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return NoticeResponse.model_validate(obj)
    
    @staticmethod
    async def delete_notice(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除公告（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Notice.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"公告 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
