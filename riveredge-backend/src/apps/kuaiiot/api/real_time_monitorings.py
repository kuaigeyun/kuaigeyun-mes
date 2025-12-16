"""
实时监控 API 模块

提供实时监控的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiiot.services.real_time_monitoring_service import RealTimeMonitoringService
from apps.kuaiiot.schemas.real_time_monitoring_schemas import (
    RealTimeMonitoringCreate, RealTimeMonitoringUpdate, RealTimeMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/real-time-monitorings", tags=["实时监控"])


@router.post("", response_model=RealTimeMonitoringResponse, summary="创建实时监控")
async def create_real_time_monitoring(
    data: RealTimeMonitoringCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建实时监控"""
    try:
        return await RealTimeMonitoringService.create_real_time_monitoring(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[RealTimeMonitoringResponse], summary="获取实时监控列表")
async def list_real_time_monitorings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取实时监控列表"""
    return await RealTimeMonitoringService.list_real_time_monitorings(tenant_id, skip, limit, status)


@router.get("/{{obj_uuid}}", response_model=RealTimeMonitoringResponse, summary="获取实时监控详情")
async def get_real_time_monitoring(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取实时监控详情"""
    try:
        return await RealTimeMonitoringService.get_real_time_monitoring_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{{obj_uuid}}", response_model=RealTimeMonitoringResponse, summary="更新实时监控")
async def update_real_time_monitoring(
    obj_uuid: str,
    data: RealTimeMonitoringUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新实时监控"""
    try:
        return await RealTimeMonitoringService.update_real_time_monitoring(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{{obj_uuid}}", status_code=status.HTTP_204_NO_CONTENT, summary="删除实时监控")
async def delete_real_time_monitoring(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除实时监控"""
    try:
        await RealTimeMonitoringService.delete_real_time_monitoring(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
