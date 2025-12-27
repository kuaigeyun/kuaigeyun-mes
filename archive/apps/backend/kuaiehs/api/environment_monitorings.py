"""
环境监测 API 模块

提供环境监测的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.environment_monitoring_service import EnvironmentMonitoringService
from apps.kuaiehs.schemas.environment_monitoring_schemas import (
    EnvironmentMonitoringCreate, EnvironmentMonitoringUpdate, EnvironmentMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/environment-monitoring", tags=["Environmental Monitoring"])


@router.post("", response_model=EnvironmentMonitoringResponse, summary="创建环境监测")
async def create_environmentmonitoring(
    data: EnvironmentMonitoringCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建环境监测"""
    try:
        return await EnvironmentMonitoringService.create_environmentmonitoring(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EnvironmentMonitoringResponse], summary="获取环境监测列表")
async def list_environmentmonitorings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取环境监测列表"""
    return await EnvironmentMonitoringService.list_environmentmonitorings(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=EnvironmentMonitoringResponse, summary="获取环境监测详情")
async def get_environmentmonitoring(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取环境监测详情"""
    try:
        return await EnvironmentMonitoringService.get_environmentmonitoring_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=EnvironmentMonitoringResponse, summary="更新环境监测")
async def update_environmentmonitoring(
    obj_uuid: str,
    data: EnvironmentMonitoringUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新环境监测"""
    try:
        return await EnvironmentMonitoringService.update_environmentmonitoring(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除环境监测")
async def delete_environmentmonitoring(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除环境监测（软删除）"""
    try:
        await EnvironmentMonitoringService.delete_environmentmonitoring(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
