"""
KPI预警 API 模块

提供KPI预警的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.kpi_alert_service import KPIAlertService
from apps.kuaiepm.schemas.kpi_alert_schemas import (
    KPIAlertCreate, KPIAlertUpdate, KPIAlertResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/kpi-alert", tags=["KPI Alerts"])


@router.post("", response_model=KPIAlertResponse, summary="创建KPI预警")
async def create_kpialert(
    data: KPIAlertCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建KPI预警"""
    try:
        return await KPIAlertService.create_kpialert(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[KPIAlertResponse], summary="获取KPI预警列表")
async def list_kpialerts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取KPI预警列表"""
    return await KPIAlertService.list_kpialerts(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=KPIAlertResponse, summary="获取KPI预警详情")
async def get_kpialert(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取KPI预警详情"""
    try:
        return await KPIAlertService.get_kpialert_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=KPIAlertResponse, summary="更新KPI预警")
async def update_kpialert(
    obj_uuid: str,
    data: KPIAlertUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新KPI预警"""
    try:
        return await KPIAlertService.update_kpialert(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除KPI预警")
async def delete_kpialert(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除KPI预警（软删除）"""
    try:
        await KPIAlertService.delete_kpialert(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
