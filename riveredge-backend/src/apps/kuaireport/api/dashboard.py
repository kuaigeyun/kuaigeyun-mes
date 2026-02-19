from fastapi import APIRouter, Depends, Query, Body
from typing import Optional
from core.api.deps import get_current_user, get_current_tenant
from core.services.application.application_service import ApplicationService
from core.services.system.menu_service import MenuService
from core.schemas.menu import MenuCreate
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


@router.get("/shared", response_model=DashboardResponse, summary="通过分享链接获取大屏（公开）")
async def get_dashboard_by_share_token(
    token: str = Query(..., description="分享令牌"),
):
    """通过分享令牌获取大屏详情，无需登录"""
    dashboard = await dashboard_service.get_by_share_token(token)
    if not dashboard:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="分享链接无效或已过期")
    return DashboardResponse.model_validate(dashboard)


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


@router.post("/{id}/share", summary="生成分享链接")
async def share_dashboard(
    id: int,
    expires_days: Optional[int] = Body(30, embed=True),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """生成大屏分享链接"""
    return await dashboard_service.share(tenant_id=tenant_id, dashboard_id=id, expires_days=expires_days)


@router.post("/{id}/unshare", summary="取消分享")
async def unshare_dashboard(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """取消大屏分享"""
    await dashboard_service.unshare(tenant_id=tenant_id, dashboard_id=id)
    return {"success": True}


@router.post("/{id}/mount-to-menu", summary="挂载到菜单")
async def mount_dashboard_to_menu(
    id: int,
    menu_name: Optional[str] = Body(None, embed=True),
    parent_uuid: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """将大屏挂载到侧边栏菜单"""
    dashboard = await dashboard_service.get_by_id(tenant_id=tenant_id, id=id)
    app = await ApplicationService.get_application_by_code(tenant_id, "kuaireport")
    if not app:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="报表与看板应用未安装")
    name = menu_name or dashboard.name
    path = f"/apps/kuaireport/dashboards/{id}"
    menu_data = MenuCreate(
        name=name,
        path=path,
        icon="dashboard",
        application_uuid=str(app["uuid"]),
        parent_uuid=parent_uuid,
        sort_order=100,
    )
    menu = await MenuService.create_menu(tenant_id=tenant_id, data=menu_data)
    return {"success": True, "menu": menu}
