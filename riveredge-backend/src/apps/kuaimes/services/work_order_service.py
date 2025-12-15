"""
工单服务模块

提供工单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimes.models.work_order import WorkOrder
from apps.kuaimes.schemas.work_order_schemas import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class WorkOrderService:
    """工单服务"""
    
    @staticmethod
    async def create_work_order(
        tenant_id: int,
        data: WorkOrderCreate
    ) -> WorkOrderResponse:
        """创建工单"""
        existing = await WorkOrder.filter(
            tenant_id=tenant_id,
            work_order_no=data.work_order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工单编号 {data.work_order_no} 已存在")
        
        work_order = await WorkOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return WorkOrderResponse.model_validate(work_order)
    
    @staticmethod
    async def get_work_order_by_uuid(
        tenant_id: int,
        work_order_uuid: str
    ) -> WorkOrderResponse:
        """根据UUID获取工单"""
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")
        
        return WorkOrderResponse.model_validate(work_order)
    
    @staticmethod
    async def list_work_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        order_uuid: Optional[str] = None
    ) -> List[WorkOrderResponse]:
        """获取工单列表"""
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if order_uuid:
            query = query.filter(order_uuid=order_uuid)
        
        work_orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [WorkOrderResponse.model_validate(wo) for wo in work_orders]
    
    @staticmethod
    async def update_work_order(
        tenant_id: int,
        work_order_uuid: str,
        data: WorkOrderUpdate
    ) -> WorkOrderResponse:
        """更新工单"""
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(work_order, key, value)
        
        await work_order.save()
        
        return WorkOrderResponse.model_validate(work_order)
    
    @staticmethod
    async def delete_work_order(
        tenant_id: int,
        work_order_uuid: str
    ) -> None:
        """删除工单（软删除）"""
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")
        
        work_order.deleted_at = datetime.utcnow()
        await work_order.save()
