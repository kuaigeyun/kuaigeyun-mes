"""
经营仪表盘 API 模块

提供经营仪表盘的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.business_dashboard_service import BusinessDashboardService
from apps.kuaiepm.schemas.business_dashboard_schemas import (
    BusinessDashboardCreate, BusinessDashboardUpdate, BusinessDashboardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/business-dashboard", tags=["Business Dashboards"])


@router.post("", response_model=BusinessDashboardResponse, summary="创建经营仪表盘")
async def create_businessdashboard(
    data: BusinessDashboardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建经营仪表盘"""
    try:
        return await BusinessDashboardService.create_businessdashboard(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[BusinessDashboardResponse], summary="获取经营仪表盘列表")
async def list_businessdashboards(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取经营仪表盘列表"""
    return await BusinessDashboardService.list_businessdashboards(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=BusinessDashboardResponse, summary="获取经营仪表盘详情")
async def get_businessdashboard(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取经营仪表盘详情"""
    try:
        return await BusinessDashboardService.get_businessdashboard_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=BusinessDashboardResponse, summary="更新经营仪表盘")
async def update_businessdashboard(
    obj_uuid: str,
    data: BusinessDashboardUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新经营仪表盘"""
    try:
        return await BusinessDashboardService.update_businessdashboard(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除经营仪表盘")
async def delete_businessdashboard(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除经营仪表盘（软删除）"""
    try:
        await BusinessDashboardService.delete_businessdashboard(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
