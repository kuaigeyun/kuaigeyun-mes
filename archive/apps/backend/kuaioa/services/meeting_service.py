"""
会议服务模块

提供会议的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.meeting import Meeting
from apps.kuaioa.schemas.meeting_schemas import (
    MeetingCreate, MeetingUpdate, MeetingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MeetingService:
    """会议服务"""
    
    @staticmethod
    async def create_meeting(
        tenant_id: int,
        data: MeetingCreate
    ) -> MeetingResponse:
        """
        创建会议
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            MeetingResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Meeting.filter(
            tenant_id=tenant_id,
            meeting_no=data.meeting_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"会议编号 {data.meeting_no} 已存在")
        
        # 创建对象
        obj = await Meeting.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MeetingResponse.model_validate(obj)
    
    @staticmethod
    async def get_meeting_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> MeetingResponse:
        """
        根据UUID获取会议
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            MeetingResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Meeting.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议 {obj_uuid} 不存在")
        
        return MeetingResponse.model_validate(obj)
    
    @staticmethod
    async def list_meetings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[MeetingResponse]:
        """
        获取会议列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[MeetingResponse]: 对象列表
        """
        query = Meeting.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [MeetingResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_meeting(
        tenant_id: int,
        obj_uuid: str,
        data: MeetingUpdate
    ) -> MeetingResponse:
        """
        更新会议
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            MeetingResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Meeting.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return MeetingResponse.model_validate(obj)
    
    @staticmethod
    async def delete_meeting(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除会议（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Meeting.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
