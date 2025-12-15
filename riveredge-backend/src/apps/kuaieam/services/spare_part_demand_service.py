"""
备件需求服务模块

提供备件需求的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.spare_part_demand import SparePartDemand
from apps.kuaieam.schemas.spare_part_demand_schemas import (
    SparePartDemandCreate, SparePartDemandUpdate, SparePartDemandResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SparePartDemandService:
    """备件需求服务"""
    
    @staticmethod
    async def create_spare_part_demand(
        tenant_id: int,
        data: SparePartDemandCreate
    ) -> SparePartDemandResponse:
        """创建备件需求"""
        existing = await SparePartDemand.filter(
            tenant_id=tenant_id,
            demand_no=data.demand_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"备件需求单编号 {data.demand_no} 已存在")
        
        demand = await SparePartDemand.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SparePartDemandResponse.model_validate(demand)
    
    @staticmethod
    async def get_spare_part_demand_by_uuid(
        tenant_id: int,
        demand_uuid: str
    ) -> SparePartDemandResponse:
        """根据UUID获取备件需求"""
        demand = await SparePartDemand.filter(
            tenant_id=tenant_id,
            uuid=demand_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not demand:
            raise NotFoundError(f"备件需求 {demand_uuid} 不存在")
        
        return SparePartDemandResponse.model_validate(demand)
    
    @staticmethod
    async def list_spare_part_demands(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        source_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SparePartDemandResponse]:
        """获取备件需求列表"""
        query = SparePartDemand.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if source_type:
            query = query.filter(source_type=source_type)
        if status:
            query = query.filter(status=status)
        
        demands = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SparePartDemandResponse.model_validate(d) for d in demands]
    
    @staticmethod
    async def update_spare_part_demand(
        tenant_id: int,
        demand_uuid: str,
        data: SparePartDemandUpdate
    ) -> SparePartDemandResponse:
        """更新备件需求"""
        demand = await SparePartDemand.filter(
            tenant_id=tenant_id,
            uuid=demand_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not demand:
            raise NotFoundError(f"备件需求 {demand_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(demand, key, value)
        
        await demand.save()
        
        return SparePartDemandResponse.model_validate(demand)
    
    @staticmethod
    async def delete_spare_part_demand(
        tenant_id: int,
        demand_uuid: str
    ) -> None:
        """删除备件需求（软删除）"""
        demand = await SparePartDemand.filter(
            tenant_id=tenant_id,
            uuid=demand_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not demand:
            raise NotFoundError(f"备件需求 {demand_uuid} 不存在")
        
        demand.deleted_at = datetime.utcnow()
        await demand.save()
