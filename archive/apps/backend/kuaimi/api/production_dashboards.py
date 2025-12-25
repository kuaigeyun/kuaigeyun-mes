"""
实时生产看板 API 模块

提供实时生产看板的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimi.services.production_dashboard_service import ProductionDashboardService
from apps.kuaimi.schemas.production_dashboard_schemas import (
    ProductionDashboardCreate, ProductionDashboardUpdate, ProductionDashboardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/production-dashboards", tags=["ProductionDashboards"])


@router.post("", response_model=ProductionDashboardResponse, status_code=status.HTTP_201_CREATED, summary="创建实时生产看板")
async def create_production_dashboard(
    data: ProductionDashboardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建实时生产看板"""
    try:
        return await ProductionDashboardService.create_production_dashboard(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProductionDashboardResponse], summary="获取实时生产看板列表")
async def list_production_dashboards(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    dashboard_type: Optional[str] = Query(None, description="看板类型（过滤）"),
    alert_level: Optional[str] = Query(None, description="报警等级（过滤）"),
    alert_status: Optional[str] = Query(None, description="报警状态（过滤）")
):
    """获取实时生产看板列表"""
    return await ProductionDashboardService.list_production_dashboards(tenant_id, skip, limit, dashboard_type, alert_level, alert_status)


@router.get("/{dashboard_uuid}", response_model=ProductionDashboardResponse, summary="获取实时生产看板详情")
async def get_production_dashboard(
    dashboard_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取实时生产看板详情"""
    try:
        return await ProductionDashboardService.get_production_dashboard_by_uuid(tenant_id, dashboard_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{dashboard_uuid}", response_model=ProductionDashboardResponse, summary="更新实时生产看板")
async def update_production_dashboard(
    dashboard_uuid: str,
    data: ProductionDashboardUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新实时生产看板"""
    try:
        return await ProductionDashboardService.update_production_dashboard(tenant_id, dashboard_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{dashboard_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除实时生产看板")
async def delete_production_dashboard(
    dashboard_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除实时生产看板"""
    try:
        await ProductionDashboardService.delete_production_dashboard(tenant_id, dashboard_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

