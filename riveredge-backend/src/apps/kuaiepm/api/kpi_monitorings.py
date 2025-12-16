"""
KPI监控 API 模块

提供KPI监控的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.kpi_monitoring_service import KPIMonitoringService
from apps.kuaiepm.schemas.kpi_monitoring_schemas import (
    KPIMonitoringCreate, KPIMonitoringUpdate, KPIMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/kpi-monitoring", tags=["KPI Monitoring"])


@router.post("", response_model=KPIMonitoringResponse, summary="创建KPI监控")
async def create_kpimonitoring(
    data: KPIMonitoringCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建KPI监控"""
    try:
        return await KPIMonitoringService.create_kpimonitoring(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[KPIMonitoringResponse], summary="获取KPI监控列表")
async def list_kpimonitorings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取KPI监控列表"""
    return await KPIMonitoringService.list_kpimonitorings(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=KPIMonitoringResponse, summary="获取KPI监控详情")
async def get_kpimonitoring(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取KPI监控详情"""
    try:
        return await KPIMonitoringService.get_kpimonitoring_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=KPIMonitoringResponse, summary="更新KPI监控")
async def update_kpimonitoring(
    obj_uuid: str,
    data: KPIMonitoringUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新KPI监控"""
    try:
        return await KPIMonitoringService.update_kpimonitoring(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除KPI监控")
async def delete_kpimonitoring(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除KPI监控（软删除）"""
    try:
        await KPIMonitoringService.delete_kpimonitoring(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
