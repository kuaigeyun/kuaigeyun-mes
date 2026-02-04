from fastapi import APIRouter, Depends, Query
from typing import Optional, Dict, Any
from core.api.deps import get_current_user, get_current_tenant
from apps.kuaireport.services.report_service import ReportService
from apps.kuaireport.schemas.report import (
    ReportCreate, ReportUpdate, ReportResponse, ReportListResponse, ReportPreviewRequest
)

router = APIRouter(prefix="/reports", tags=["KuanReport - Reports"])

report_service = ReportService()

@router.post("", response_model=ReportResponse, summary="创建报表")
async def create_report(
    data: ReportCreate,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await report_service.create(tenant_id=tenant_id, data=data, created_by=current_user["id"])

@router.get("", response_model=ReportListResponse, summary="获取报表列表")
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await report_service.list(tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/{id}", response_model=ReportResponse, summary="获取报表详情")
async def get_report(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await report_service.get_by_id(tenant_id=tenant_id, id=id)

@router.put("/{id}", response_model=ReportResponse, summary="更新报表")
async def update_report(
    id: int,
    data: ReportUpdate,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await report_service.update(tenant_id=tenant_id, id=id, data=data, updated_by=current_user["id"])

@router.delete("/{id}", summary="删除报表")
async def delete_report(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    await report_service.delete(tenant_id=tenant_id, id=id)
    return {"success": True}

@router.post("/{id}/query", summary="执行报表查询")
async def query_report(
    id: int,
    filters: Dict[str, Any] = {},
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据报表配置执行动态查询并返回数据
    """
    return await report_service.execute_report(tenant_id=tenant_id, report_id=id, filters=filters)

@router.post("/preview", summary="预览报表数据")
async def preview_report_data(
    data: ReportPreviewRequest,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据传入的配置预览数据 (不保存报表)
    """
    return await report_service.preview_data_by_config(
        tenant_id=tenant_id, 
        datasource=data.datasource, 
        filters=data.filters or {}
    )
