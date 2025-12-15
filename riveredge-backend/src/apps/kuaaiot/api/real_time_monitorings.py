"""
实时监控 API 模块

提供实时监控的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaaiot.services.real_time_monitoring_service import RealTimeMonitoringService
from apps.kuaaiot.schemas.real_time_monitoring_schemas import (
    RealTimeMonitoringCreate, RealTimeMonitoringUpdate, RealTimeMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/real-time-monitorings", tags=["RealTimeMonitorings"])


@router.post("", response_model=RealTimeMonitoringResponse, status_code=status.HTTP_201_CREATED, summary="创建实时监控")
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
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    monitoring_type: Optional[str] = Query(None, description="监控类型（过滤）"),
    device_id: Optional[int] = Query(None, description="设备ID（过滤）"),
    alert_status: Optional[str] = Query(None, description="预警状态（过滤）")
):
    """获取实时监控列表"""
    return await RealTimeMonitoringService.list_real_time_monitorings(tenant_id, skip, limit, monitoring_type, device_id, alert_status)


@router.get("/{monitoring_uuid}", response_model=RealTimeMonitoringResponse, summary="获取实时监控详情")
async def get_real_time_monitoring(
    monitoring_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取实时监控详情"""
    try:
        return await RealTimeMonitoringService.get_real_time_monitoring_by_uuid(tenant_id, monitoring_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{monitoring_uuid}", response_model=RealTimeMonitoringResponse, summary="更新实时监控")
async def update_real_time_monitoring(
    monitoring_uuid: str,
    data: RealTimeMonitoringUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新实时监控"""
    try:
        return await RealTimeMonitoringService.update_real_time_monitoring(tenant_id, monitoring_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{monitoring_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除实时监控")
async def delete_real_time_monitoring(
    monitoring_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除实时监控"""
    try:
        await RealTimeMonitoringService.delete_real_time_monitoring(tenant_id, monitoring_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

