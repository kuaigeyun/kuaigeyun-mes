"""
会议纪要服务模块

提供会议纪要的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.meeting import MeetingMinutes
from apps.kuaioa.schemas.meeting_minutes_schemas import (
    MeetingMinutesCreate, MeetingMinutesUpdate, MeetingMinutesResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MeetingMinutesService:
    """会议纪要服务"""
    
    @staticmethod
    async def create_meetingminutes(
        tenant_id: int,
        data: MeetingMinutesCreate
    ) -> MeetingMinutesResponse:
        """
        创建会议纪要
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            MeetingMinutesResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await MeetingMinutes.filter(
            tenant_id=tenant_id,
            minutes_no=data.minutes_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"纪要编号 {data.minutes_no} 已存在")
        
        # 创建对象
        obj = await MeetingMinutes.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MeetingMinutesResponse.model_validate(obj)
    
    @staticmethod
    async def get_meetingminutes_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> MeetingMinutesResponse:
        """
        根据UUID获取会议纪要
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            MeetingMinutesResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await MeetingMinutes.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议纪要 {obj_uuid} 不存在")
        
        return MeetingMinutesResponse.model_validate(obj)
    
    @staticmethod
    async def list_meetingminutess(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[MeetingMinutesResponse]:
        """
        获取会议纪要列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[MeetingMinutesResponse]: 对象列表
        """
        query = MeetingMinutes.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [MeetingMinutesResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_meetingminutes(
        tenant_id: int,
        obj_uuid: str,
        data: MeetingMinutesUpdate
    ) -> MeetingMinutesResponse:
        """
        更新会议纪要
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            MeetingMinutesResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await MeetingMinutes.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议纪要 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return MeetingMinutesResponse.model_validate(obj)
    
    @staticmethod
    async def delete_meetingminutes(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除会议纪要（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await MeetingMinutes.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"会议纪要 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
