"""
设备状态监控 API 路由

提供设备状态监控相关的API接口。

Author: Luigi Lu
Date: 2026-01-16
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.equipment_status_monitor import (
    EquipmentStatusMonitorCreate,
    EquipmentStatusMonitorUpdate,
    EquipmentStatusMonitorResponse,
    EquipmentStatusMonitorListResponse,
    EquipmentStatusHistoryResponse,
    EquipmentStatusHistoryListResponse,
    EquipmentStatusUpdateRequest,
)
from apps.kuaizhizao.services.equipment_status_monitor_service import EquipmentStatusMonitorService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/equipment-status", tags=["Kuaige Zhizao Equipment Status Monitor"])


@router.post("/monitors", response_model=EquipmentStatusMonitorResponse, status_code=status.HTTP_201_CREATED)
async def create_status_monitor(
    data: EquipmentStatusMonitorCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建设备状态监控记录
    
    创建新的设备状态监控记录，可用于手动更新或SCADA数据采集。
    """
    try:
        monitor_service = EquipmentStatusMonitorService()
        monitor = await monitor_service.create_status_monitor(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return EquipmentStatusMonitorResponse.model_validate(monitor)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"创建监控记录失败: {str(e)}")


@router.get("/monitors", response_model=EquipmentStatusMonitorListResponse)
async def list_status_monitors(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    equipment_uuid: Optional[str] = Query(None, description="设备UUID（可选）"),
    status: Optional[str] = Query(None, description="设备状态（可选）"),
    is_online: Optional[bool] = Query(None, description="是否在线（可选）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备状态监控列表
    
    获取设备状态监控记录列表，支持筛选和搜索。
    """
    try:
        monitor_service = EquipmentStatusMonitorService()
        
        date_start_dt = None
        date_end_dt = None
        if date_start:
            date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
        if date_end:
            date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))
        
        monitors, total = await monitor_service.list_equipment_status(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            equipment_uuid=equipment_uuid,
            status=status,
            is_online=is_online,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
        
        items = [EquipmentStatusMonitorResponse.model_validate(m) for m in monitors]
        
        return EquipmentStatusMonitorListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取监控列表失败: {str(e)}")


@router.get("/realtime", response_model=List[dict])
async def get_realtime_status_list(
    equipment_ids: Optional[str] = Query(None, description="设备ID列表（逗号分隔）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备实时状态列表
    
    获取所有设备的实时状态，返回每个设备的最新状态信息。
    """
    try:
        monitor_service = EquipmentStatusMonitorService()
        
        equipment_id_list = None
        if equipment_ids:
            equipment_id_list = [int(id.strip()) for id in equipment_ids.split(',') if id.strip()]
        
        status_list = await monitor_service.get_realtime_status_list(
            tenant_id=tenant_id,
            equipment_ids=equipment_id_list,
        )
        
        return status_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取实时状态列表失败: {str(e)}")


@router.get("/equipment/{equipment_uuid}/latest", response_model=Optional[EquipmentStatusMonitorResponse])
async def get_latest_status(
    equipment_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备最新状态
    
    获取指定设备的最新状态监控记录。
    """
    try:
        monitor_service = EquipmentStatusMonitorService()
        latest_status = await monitor_service.get_latest_status(tenant_id, equipment_uuid)
        
        if not latest_status:
            return None
        
        return EquipmentStatusMonitorResponse.model_validate(latest_status)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取最新状态失败: {str(e)}")


@router.post("/update", response_model=EquipmentStatusMonitorResponse, status_code=status.HTTP_201_CREATED)
async def update_equipment_status(
    data: EquipmentStatusUpdateRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新设备状态
    
    手动更新设备状态，会自动创建监控记录和状态历史记录。
    """
    try:
        monitor_service = EquipmentStatusMonitorService()
        monitor = await monitor_service.update_equipment_status(
            tenant_id=tenant_id,
            data=data,
            updated_by=current_user.id
        )
        return EquipmentStatusMonitorResponse.model_validate(monitor)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"更新设备状态失败: {str(e)}")


@router.get("/equipment/{equipment_uuid}/history", response_model=EquipmentStatusHistoryListResponse)
async def get_status_history(
    equipment_uuid: str,
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备状态历史
    
    获取指定设备的状态变更历史记录。
    """
    try:
        monitor_service = EquipmentStatusMonitorService()
        history_list, total = await monitor_service.get_status_history(
            tenant_id=tenant_id,
            equipment_uuid=equipment_uuid,
            skip=skip,
            limit=limit,
        )
        
        items = [EquipmentStatusHistoryResponse.model_validate(h) for h in history_list]
        
        return EquipmentStatusHistoryListResponse(
            items=items,
            total=total
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取状态历史失败: {str(e)}")
