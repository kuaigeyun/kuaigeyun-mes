"""
产能规划服务模块

提供产能规划的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiaps.models.capacity_planning import CapacityPlanning
from apps.kuaiaps.schemas.capacity_planning_schemas import (
    CapacityPlanningCreate, CapacityPlanningUpdate, CapacityPlanningResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CapacityPlanningService:
    """产能规划服务"""
    
    @staticmethod
    async def create_capacity_planning(
        tenant_id: int,
        data: CapacityPlanningCreate
    ) -> CapacityPlanningResponse:
        """创建产能规划"""
        existing = await CapacityPlanning.filter(
            tenant_id=tenant_id,
            planning_no=data.planning_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"产能规划编号 {data.planning_no} 已存在")
        
        planning = await CapacityPlanning.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CapacityPlanningResponse.model_validate(planning)
    
    @staticmethod
    async def get_capacity_planning_by_uuid(
        tenant_id: int,
        planning_uuid: str
    ) -> CapacityPlanningResponse:
        """根据UUID获取产能规划"""
        planning = await CapacityPlanning.filter(
            tenant_id=tenant_id,
            uuid=planning_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not planning:
            raise NotFoundError(f"产能规划 {planning_uuid} 不存在")
        
        return CapacityPlanningResponse.model_validate(planning)
    
    @staticmethod
    async def list_capacity_plannings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        resource_type: Optional[str] = None,
        bottleneck_status: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[CapacityPlanningResponse]:
        """获取产能规划列表"""
        query = CapacityPlanning.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if resource_type:
            query = query.filter(resource_type=resource_type)
        if bottleneck_status:
            query = query.filter(bottleneck_status=bottleneck_status)
        if status:
            query = query.filter(status=status)
        
        plannings = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [CapacityPlanningResponse.model_validate(p) for p in plannings]
    
    @staticmethod
    async def update_capacity_planning(
        tenant_id: int,
        planning_uuid: str,
        data: CapacityPlanningUpdate
    ) -> CapacityPlanningResponse:
        """更新产能规划"""
        planning = await CapacityPlanning.filter(
            tenant_id=tenant_id,
            uuid=planning_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not planning:
            raise NotFoundError(f"产能规划 {planning_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(planning, key, value)
        
        await planning.save()
        
        return CapacityPlanningResponse.model_validate(planning)
    
    @staticmethod
    async def delete_capacity_planning(
        tenant_id: int,
        planning_uuid: str
    ) -> None:
        """删除产能规划（软删除）"""
        planning = await CapacityPlanning.filter(
            tenant_id=tenant_id,
            uuid=planning_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not planning:
            raise NotFoundError(f"产能规划 {planning_uuid} 不存在")
        
        planning.deleted_at = datetime.utcnow()
        await planning.save()

