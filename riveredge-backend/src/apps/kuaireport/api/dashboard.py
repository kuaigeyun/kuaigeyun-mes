from fastapi import APIRouter, Depends, Query
from typing import Optional
from core.api.deps import get_current_user, get_current_tenant
from apps.kuaireport.services.dashboard_service import DashboardService
from apps.kuaireport.schemas.dashboard import (
    DashboardCreate, DashboardUpdate, DashboardResponse, DashboardListResponse
)

router = APIRouter(prefix="/dashboards", tags=["KuanReport - Dashboards"])

dashboard_service = DashboardService()

@router.post("", response_model=DashboardResponse, summary="创建看板")
async def create_dashboard(
    data: DashboardCreate,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await dashboard_service.create(tenant_id=tenant_id, data=data, created_by=current_user["id"])

@router.get("", response_model=DashboardListResponse, summary="获取看板列表")
async def list_dashboards(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await dashboard_service.list(tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/{id}", response_model=DashboardResponse, summary="获取看板详情")
async def get_dashboard(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await dashboard_service.get_by_id(tenant_id=tenant_id, id=id)

@router.put("/{id}", response_model=DashboardResponse, summary="更新看板")
async def update_dashboard(
    id: int,
    data: DashboardUpdate,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await dashboard_service.update(tenant_id=tenant_id, id=id, data=data, updated_by=current_user["id"])

@router.delete("/{id}", summary="删除看板")
async def delete_dashboard(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    await dashboard_service.delete(tenant_id=tenant_id, id=id)
    return {"success": True}
