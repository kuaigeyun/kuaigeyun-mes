from fastapi import APIRouter, Depends, Query, Body
from typing import Optional, Dict, Any
from core.api.deps import get_current_user, get_current_tenant
from core.services.application.application_service import ApplicationService
from core.services.system.menu_service import MenuService
from core.schemas.menu import MenuCreate
from apps.kuaireport.services.report_service import ReportService
from apps.kuaireport.schemas.report import (
    ReportCreate, ReportUpdate, ReportResponse, ReportListResponse
)

router = APIRouter(prefix="/reports", tags=["报表中心 - Reports"])

report_service = ReportService()


# ── 系统报表 ─────────────────────────────────────────────────────

@router.get("/system", response_model=ReportListResponse, summary="获取系统报表列表")
async def list_system_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await report_service.list_system_reports(
        tenant_id=tenant_id, skip=skip, limit=limit
    )


# ── 用户自制报表 ───────────────────────────────────────────────

@router.get("/my", response_model=ReportListResponse, summary="获取我的自制报表")
async def list_my_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await report_service.list_user_reports(
        tenant_id=tenant_id, user_id=current_user["id"], skip=skip, limit=limit
    )


# ── 公开分享（需在 /{id} 之前定义）──────────────────────────────────

@router.get("/shared", response_model=ReportResponse, summary="通过分享链接获取报表（公开）")
async def get_report_by_share_token(
    token: str = Query(..., description="分享令牌"),
):
    """通过分享令牌获取报表详情，无需登录"""
    report = await report_service.get_by_share_token(token)
    if not report:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="分享链接无效或已过期")
    return ReportResponse.model_validate(report)


@router.post("/shared/execute", summary="通过分享链接执行报表查询（公开）")
async def execute_report_by_share_token_route(
    token: str = Query(..., description="分享令牌"),
    filters: Dict[str, Any] = Body(default_factory=dict),
):
    """通过分享令牌执行报表查询，无需登录"""
    return await report_service.execute_report_by_share_token(token, filters)


# ── 通用 CRUD ────────────────────────────────────────────────────

@router.get("", response_model=ReportListResponse, summary="获取报表列表（管理员）")
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await report_service.list(tenant_id=tenant_id, skip=skip, limit=limit)


@router.post("", response_model=ReportResponse, summary="创建报表")
async def create_report(
    data: ReportCreate,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await report_service.create(
        tenant_id=tenant_id, data=data, created_by=current_user["id"]
    )


@router.get("/{id}", response_model=ReportResponse, summary="获取报表详情")
async def get_report(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await report_service.get_by_id(tenant_id=tenant_id, id=id)


@router.put("/{id}", response_model=ReportResponse, summary="更新报表")
async def update_report(
    id: int,
    data: ReportUpdate,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await report_service.update(
        tenant_id=tenant_id,
        id=id,
        data=data,
        updated_by=current_user["id"],
        user_id=current_user["id"],
    )


@router.delete("/{id}", summary="删除报表")
async def delete_report(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await report_service.delete(
        tenant_id=tenant_id, id=id, user_id=current_user["id"]
    )
    return {"success": True}


# ── 数据执行 ─────────────────────────────────────────────────────

@router.post("/{id}/execute", summary="执行报表查询")
async def execute_report(
    id: int,
    filters: Dict[str, Any] = {},
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """根据报表配置执行动态查询并返回数据"""
    return await report_service.execute_report(
        tenant_id=tenant_id, report_id=id, filters=filters
    )


# ── 分享与挂载 ───────────────────────────────────────────────────

@router.post("/{id}/share", summary="生成分享链接")
async def share_report(
    id: int,
    expires_days: Optional[int] = Body(30, embed=True),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """生成报表分享链接，返回 share_token 和 share_expires_at"""
    result = await report_service.share(tenant_id=tenant_id, report_id=id, expires_days=expires_days)
    return result


@router.post("/{id}/unshare", summary="取消分享")
async def unshare_report(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """取消报表分享"""
    await report_service.unshare(tenant_id=tenant_id, report_id=id)
    return {"success": True}


@router.post("/{id}/mount-to-menu", summary="挂载到菜单")
async def mount_report_to_menu(
    id: int,
    menu_name: Optional[str] = Body(None, embed=True),
    parent_uuid: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """将报表挂载到侧边栏菜单"""
    report = await report_service.get_by_id(tenant_id=tenant_id, id=id)
    app = await ApplicationService.get_application_by_code(tenant_id, "kuaireport")
    if not app:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="报表与看板应用未安装")
    name = menu_name or report.name
    path = f"/apps/kuaireport/reports/{id}"
    menu_data = MenuCreate(
        name=name,
        path=path,
        icon="bar-chart",
        application_uuid=str(app["uuid"]),
        parent_uuid=parent_uuid,
        sort_order=100,
    )
    menu = await MenuService.create_menu(tenant_id=tenant_id, data=menu_data)
    return {"success": True, "menu": menu}
