"""
能源监测 API 模块

提供能源监测的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiems.services.energy_monitoring_service import EnergyMonitoringService
from apps.kuaiems.schemas.energy_monitoring_schemas import (
    EnergyMonitoringCreate, EnergyMonitoringUpdate, EnergyMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/energy-monitorings", tags=["EnergyMonitorings"])


@router.post("", response_model=EnergyMonitoringResponse, status_code=status.HTTP_201_CREATED, summary="创建能源监测")
async def create_energy_monitoring(
    data: EnergyMonitoringCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建能源监测"""
    try:
        return await EnergyMonitoringService.create_energy_monitoring(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EnergyMonitoringResponse], summary="获取能源监测列表")
async def list_energy_monitorings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    energy_type: Optional[str] = Query(None, description="能源类型（过滤）"),
    collection_status: Optional[str] = Query(None, description="采集状态（过滤）"),
    alert_status: Optional[str] = Query(None, description="预警状态（过滤）")
):
    """获取能源监测列表"""
    return await EnergyMonitoringService.list_energy_monitorings(tenant_id, skip, limit, energy_type, collection_status, alert_status)


@router.get("/{monitoring_uuid}", response_model=EnergyMonitoringResponse, summary="获取能源监测详情")
async def get_energy_monitoring(
    monitoring_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取能源监测详情"""
    try:
        return await EnergyMonitoringService.get_energy_monitoring_by_uuid(tenant_id, monitoring_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{monitoring_uuid}", response_model=EnergyMonitoringResponse, summary="更新能源监测")
async def update_energy_monitoring(
    monitoring_uuid: str,
    data: EnergyMonitoringUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新能源监测"""
    try:
        return await EnergyMonitoringService.update_energy_monitoring(tenant_id, monitoring_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{monitoring_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除能源监测")
async def delete_energy_monitoring(
    monitoring_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除能源监测"""
    try:
        await EnergyMonitoringService.delete_energy_monitoring(tenant_id, monitoring_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

