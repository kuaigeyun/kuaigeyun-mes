"""
维护工单服务模块

提供维护工单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.maintenance_workorder import MaintenanceWorkOrder
from apps.kuaieam.schemas.maintenance_workorder_schemas import (
    MaintenanceWorkOrderCreate, MaintenanceWorkOrderUpdate, MaintenanceWorkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaintenanceWorkOrderService:
    """维护工单服务"""
    
    @staticmethod
    async def create_maintenance_workorder(
        tenant_id: int,
        data: MaintenanceWorkOrderCreate
    ) -> MaintenanceWorkOrderResponse:
        """创建维护工单"""
        existing = await MaintenanceWorkOrder.filter(
            tenant_id=tenant_id,
            workorder_no=data.workorder_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"维护工单编号 {data.workorder_no} 已存在")
        
        workorder = await MaintenanceWorkOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MaintenanceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def get_maintenance_workorder_by_uuid(
        tenant_id: int,
        workorder_uuid: str
    ) -> MaintenanceWorkOrderResponse:
        """根据UUID获取维护工单"""
        workorder = await MaintenanceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"维护工单 {workorder_uuid} 不存在")
        
        return MaintenanceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def list_maintenance_workorders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        workorder_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[MaintenanceWorkOrderResponse]:
        """获取维护工单列表"""
        query = MaintenanceWorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if workorder_type:
            query = query.filter(workorder_type=workorder_type)
        if status:
            query = query.filter(status=status)
        
        workorders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [MaintenanceWorkOrderResponse.model_validate(w) for w in workorders]
    
    @staticmethod
    async def update_maintenance_workorder(
        tenant_id: int,
        workorder_uuid: str,
        data: MaintenanceWorkOrderUpdate
    ) -> MaintenanceWorkOrderResponse:
        """更新维护工单"""
        workorder = await MaintenanceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"维护工单 {workorder_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(workorder, key, value)
        
        await workorder.save()
        
        return MaintenanceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def delete_maintenance_workorder(
        tenant_id: int,
        workorder_uuid: str
    ) -> None:
        """删除维护工单（软删除）"""
        workorder = await MaintenanceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"维护工单 {workorder_uuid} 不存在")
        
        workorder.deleted_at = datetime.utcnow()
        await workorder.save()
