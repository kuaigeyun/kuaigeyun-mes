"""
运输需求服务模块

提供运输需求的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaitms.models.transport_demand import TransportDemand
from apps.kuaitms.schemas.transport_demand_schemas import (
    TransportDemandCreate, TransportDemandUpdate, TransportDemandResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class TransportDemandService:
    """运输需求服务"""
    
    @staticmethod
    async def create_transport_demand(
        tenant_id: int,
        data: TransportDemandCreate
    ) -> TransportDemandResponse:
        """创建运输需求"""
        existing = await TransportDemand.filter(
            tenant_id=tenant_id,
            demand_no=data.demand_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"运输需求编号 {data.demand_no} 已存在")
        
        demand = await TransportDemand.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return TransportDemandResponse.model_validate(demand)
    
    @staticmethod
    async def get_transport_demand_by_uuid(
        tenant_id: int,
        demand_uuid: str
    ) -> TransportDemandResponse:
        """根据UUID获取运输需求"""
        demand = await TransportDemand.filter(
            tenant_id=tenant_id,
            uuid=demand_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not demand:
            raise NotFoundError(f"运输需求 {demand_uuid} 不存在")
        
        return TransportDemandResponse.model_validate(demand)
    
    @staticmethod
    async def list_transport_demands(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        source_type: Optional[str] = None
    ) -> List[TransportDemandResponse]:
        """获取运输需求列表"""
        query = TransportDemand.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if source_type:
            query = query.filter(source_type=source_type)
        
        demands = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [TransportDemandResponse.model_validate(d) for d in demands]
    
    @staticmethod
    async def update_transport_demand(
        tenant_id: int,
        demand_uuid: str,
        data: TransportDemandUpdate
    ) -> TransportDemandResponse:
        """更新运输需求"""
        demand = await TransportDemand.filter(
            tenant_id=tenant_id,
            uuid=demand_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not demand:
            raise NotFoundError(f"运输需求 {demand_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(demand, key, value)
        
        await demand.save()
        
        return TransportDemandResponse.model_validate(demand)
    
    @staticmethod
    async def delete_transport_demand(
        tenant_id: int,
        demand_uuid: str
    ) -> None:
        """删除运输需求（软删除）"""
        demand = await TransportDemand.filter(
            tenant_id=tenant_id,
            uuid=demand_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not demand:
            raise NotFoundError(f"运输需求 {demand_uuid} 不存在")
        
        demand.deleted_at = datetime.utcnow()
        await demand.save()

