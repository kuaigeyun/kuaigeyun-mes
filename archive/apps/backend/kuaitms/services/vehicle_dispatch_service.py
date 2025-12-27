"""
车辆调度服务模块

提供车辆调度的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaitms.models.vehicle_dispatch import VehicleDispatch
from apps.kuaitms.schemas.vehicle_dispatch_schemas import (
    VehicleDispatchCreate, VehicleDispatchUpdate, VehicleDispatchResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class VehicleDispatchService:
    """车辆调度服务"""
    
    @staticmethod
    async def create_vehicle_dispatch(
        tenant_id: int,
        data: VehicleDispatchCreate
    ) -> VehicleDispatchResponse:
        """创建车辆调度"""
        existing = await VehicleDispatch.filter(
            tenant_id=tenant_id,
            dispatch_no=data.dispatch_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"车辆调度编号 {data.dispatch_no} 已存在")
        
        dispatch = await VehicleDispatch.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return VehicleDispatchResponse.model_validate(dispatch)
    
    @staticmethod
    async def get_vehicle_dispatch_by_uuid(
        tenant_id: int,
        dispatch_uuid: str
    ) -> VehicleDispatchResponse:
        """根据UUID获取车辆调度"""
        dispatch = await VehicleDispatch.filter(
            tenant_id=tenant_id,
            uuid=dispatch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dispatch:
            raise NotFoundError(f"车辆调度 {dispatch_uuid} 不存在")
        
        return VehicleDispatchResponse.model_validate(dispatch)
    
    @staticmethod
    async def list_vehicle_dispatches(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        vehicle_id: Optional[int] = None
    ) -> List[VehicleDispatchResponse]:
        """获取车辆调度列表"""
        query = VehicleDispatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if vehicle_id:
            query = query.filter(vehicle_id=vehicle_id)
        
        dispatches = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [VehicleDispatchResponse.model_validate(d) for d in dispatches]
    
    @staticmethod
    async def update_vehicle_dispatch(
        tenant_id: int,
        dispatch_uuid: str,
        data: VehicleDispatchUpdate
    ) -> VehicleDispatchResponse:
        """更新车辆调度"""
        dispatch = await VehicleDispatch.filter(
            tenant_id=tenant_id,
            uuid=dispatch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dispatch:
            raise NotFoundError(f"车辆调度 {dispatch_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(dispatch, key, value)
        
        await dispatch.save()
        
        return VehicleDispatchResponse.model_validate(dispatch)
    
    @staticmethod
    async def delete_vehicle_dispatch(
        tenant_id: int,
        dispatch_uuid: str
    ) -> None:
        """删除车辆调度（软删除）"""
        dispatch = await VehicleDispatch.filter(
            tenant_id=tenant_id,
            uuid=dispatch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dispatch:
            raise NotFoundError(f"车辆调度 {dispatch_uuid} 不存在")
        
        dispatch.deleted_at = datetime.utcnow()
        await dispatch.save()

