"""
资源调度服务模块

提供资源调度的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiaps.models.resource_scheduling import ResourceScheduling
from apps.kuaiaps.schemas.resource_scheduling_schemas import (
    ResourceSchedulingCreate, ResourceSchedulingUpdate, ResourceSchedulingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ResourceSchedulingService:
    """资源调度服务"""
    
    @staticmethod
    async def create_resource_scheduling(
        tenant_id: int,
        data: ResourceSchedulingCreate
    ) -> ResourceSchedulingResponse:
        """创建资源调度"""
        existing = await ResourceScheduling.filter(
            tenant_id=tenant_id,
            scheduling_no=data.scheduling_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"资源调度编号 {data.scheduling_no} 已存在")
        
        scheduling = await ResourceScheduling.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ResourceSchedulingResponse.model_validate(scheduling)
    
    @staticmethod
    async def get_resource_scheduling_by_uuid(
        tenant_id: int,
        scheduling_uuid: str
    ) -> ResourceSchedulingResponse:
        """根据UUID获取资源调度"""
        scheduling = await ResourceScheduling.filter(
            tenant_id=tenant_id,
            uuid=scheduling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not scheduling:
            raise NotFoundError(f"资源调度 {scheduling_uuid} 不存在")
        
        return ResourceSchedulingResponse.model_validate(scheduling)
    
    @staticmethod
    async def list_resource_schedulings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        resource_type: Optional[str] = None,
        availability_status: Optional[str] = None,
        scheduling_status: Optional[str] = None
    ) -> List[ResourceSchedulingResponse]:
        """获取资源调度列表"""
        query = ResourceScheduling.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if resource_type:
            query = query.filter(resource_type=resource_type)
        if availability_status:
            query = query.filter(availability_status=availability_status)
        if scheduling_status:
            query = query.filter(scheduling_status=scheduling_status)
        
        schedulings = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ResourceSchedulingResponse.model_validate(s) for s in schedulings]
    
    @staticmethod
    async def update_resource_scheduling(
        tenant_id: int,
        scheduling_uuid: str,
        data: ResourceSchedulingUpdate
    ) -> ResourceSchedulingResponse:
        """更新资源调度"""
        scheduling = await ResourceScheduling.filter(
            tenant_id=tenant_id,
            uuid=scheduling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not scheduling:
            raise NotFoundError(f"资源调度 {scheduling_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(scheduling, key, value)
        
        await scheduling.save()
        
        return ResourceSchedulingResponse.model_validate(scheduling)
    
    @staticmethod
    async def delete_resource_scheduling(
        tenant_id: int,
        scheduling_uuid: str
    ) -> None:
        """删除资源调度（软删除）"""
        scheduling = await ResourceScheduling.filter(
            tenant_id=tenant_id,
            uuid=scheduling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not scheduling:
            raise NotFoundError(f"资源调度 {scheduling_uuid} 不存在")
        
        scheduling.deleted_at = datetime.utcnow()
        await scheduling.save()

