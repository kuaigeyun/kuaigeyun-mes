"""
会议资源服务模块

提供会议资源的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.meeting import MeetingResource
from apps.kuaioa.schemas.meeting_resource_schemas import (
    MeetingResourceCreate, MeetingResourceUpdate, MeetingResourceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MeetingResourceService:
    """会议资源服务"""
    
    @staticmethod
    async def create_meetingresource(
        tenant_id: int,
        data: MeetingResourceCreate
    ) -> MeetingResourceResponse:
        """
        创建会议资源
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            MeetingResourceResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await MeetingResource.filter(
            tenant_id=tenant_id,
            resource_no=data.resource_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"资源编号 {data.resource_no} 已存在")
        
        # 创建对象
        obj = await MeetingResource.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MeetingResourceResponse.model_validate(obj)
    
    @staticmethod
    async def get_meetingresource_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> MeetingResourceResponse:
        """
        根据UUID获取会议资源
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            MeetingResourceResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await MeetingResource.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议资源 {obj_uuid} 不存在")
        
        return MeetingResourceResponse.model_validate(obj)
    
    @staticmethod
    async def list_meetingresources(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[MeetingResourceResponse]:
        """
        获取会议资源列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[MeetingResourceResponse]: 对象列表
        """
        query = MeetingResource.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [MeetingResourceResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_meetingresource(
        tenant_id: int,
        obj_uuid: str,
        data: MeetingResourceUpdate
    ) -> MeetingResourceResponse:
        """
        更新会议资源
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            MeetingResourceResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await MeetingResource.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议资源 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return MeetingResourceResponse.model_validate(obj)
    
    @staticmethod
    async def delete_meetingresource(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除会议资源（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await MeetingResource.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议资源 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
