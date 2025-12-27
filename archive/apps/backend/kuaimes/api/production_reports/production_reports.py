"""
生产报工 API 模块

提供生产报工的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimes.services.production_report_service import ProductionReportService
from apps.kuaimes.schemas.production_report_schemas import (
    ProductionReportCreate, ProductionReportUpdate, ProductionReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/production-reports", tags=["Production Reports"])


@router.post("", response_model=ProductionReportResponse, status_code=status.HTTP_201_CREATED, summary="创建生产报工")
async def create_production_report(
    data: ProductionReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建生产报工"""
    try:
        return await ProductionReportService.create_production_report(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProductionReportResponse], summary="获取生产报工列表")
async def list_production_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_uuid: Optional[str] = Query(None, description="工单UUID（过滤）"),
    status: Optional[str] = Query(None, description="报工状态（过滤）")
):
    """获取生产报工列表"""
    return await ProductionReportService.list_production_reports(tenant_id, skip, limit, work_order_uuid, status)


@router.get("/{report_uuid}", response_model=ProductionReportResponse, summary="获取生产报工详情")
async def get_production_report(
    report_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取生产报工详情"""
    try:
        return await ProductionReportService.get_production_report_by_uuid(tenant_id, report_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{report_uuid}", response_model=ProductionReportResponse, summary="更新生产报工")
async def update_production_report(
    report_uuid: str,
    data: ProductionReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新生产报工"""
    try:
        return await ProductionReportService.update_production_report(tenant_id, report_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{report_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除生产报工")
async def delete_production_report(
    report_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除生产报工（软删除）"""
    try:
        await ProductionReportService.delete_production_report(tenant_id, report_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
