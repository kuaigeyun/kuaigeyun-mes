"""
返修工单服务模块

提供返修工单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimes.models.rework_order import ReworkOrder
from apps.kuaimes.schemas.rework_order_schemas import (
    ReworkOrderCreate, ReworkOrderUpdate, ReworkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ReworkOrderService:
    """返修工单服务"""
    
    @staticmethod
    async def create_rework_order(
        tenant_id: int,
        data: ReworkOrderCreate
    ) -> ReworkOrderResponse:
        """创建返修工单"""
        existing = await ReworkOrder.filter(
            tenant_id=tenant_id,
            rework_order_no=data.rework_order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"返修工单编号 {data.rework_order_no} 已存在")
        
        rework_order = await ReworkOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ReworkOrderResponse.model_validate(rework_order)
    
    @staticmethod
    async def get_rework_order_by_uuid(
        tenant_id: int,
        rework_order_uuid: str
    ) -> ReworkOrderResponse:
        """根据UUID获取返修工单"""
        rework_order = await ReworkOrder.filter(
            tenant_id=tenant_id,
            uuid=rework_order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rework_order:
            raise NotFoundError(f"返修工单 {rework_order_uuid} 不存在")
        
        return ReworkOrderResponse.model_validate(rework_order)
    
    @staticmethod
    async def list_rework_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ReworkOrderResponse]:
        """获取返修工单列表"""
        query = ReworkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        rework_orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ReworkOrderResponse.model_validate(ro) for ro in rework_orders]
    
    @staticmethod
    async def update_rework_order(
        tenant_id: int,
        rework_order_uuid: str,
        data: ReworkOrderUpdate
    ) -> ReworkOrderResponse:
        """更新返修工单"""
        rework_order = await ReworkOrder.filter(
            tenant_id=tenant_id,
            uuid=rework_order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rework_order:
            raise NotFoundError(f"返修工单 {rework_order_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(rework_order, key, value)
        
        await rework_order.save()
        
        return ReworkOrderResponse.model_validate(rework_order)
    
    @staticmethod
    async def delete_rework_order(
        tenant_id: int,
        rework_order_uuid: str
    ) -> None:
        """删除返修工单（软删除）"""
        rework_order = await ReworkOrder.filter(
            tenant_id=tenant_id,
            uuid=rework_order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rework_order:
            raise NotFoundError(f"返修工单 {rework_order_uuid} 不存在")
        
        rework_order.deleted_at = datetime.utcnow()
        await rework_order.save()
