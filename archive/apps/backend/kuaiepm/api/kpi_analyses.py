"""
KPI分析 API 模块

提供KPI分析的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.kpi_analysis_service import KPIAnalysisService
from apps.kuaiepm.schemas.kpi_analysis_schemas import (
    KPIAnalysisCreate, KPIAnalysisUpdate, KPIAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/kpi-analysis", tags=["KPI Analysis"])


@router.post("", response_model=KPIAnalysisResponse, summary="创建KPI分析")
async def create_kpianalysis(
    data: KPIAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建KPI分析"""
    try:
        return await KPIAnalysisService.create_kpianalysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[KPIAnalysisResponse], summary="获取KPI分析列表")
async def list_kpianalysiss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取KPI分析列表"""
    return await KPIAnalysisService.list_kpianalysiss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=KPIAnalysisResponse, summary="获取KPI分析详情")
async def get_kpianalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取KPI分析详情"""
    try:
        return await KPIAnalysisService.get_kpianalysis_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=KPIAnalysisResponse, summary="更新KPI分析")
async def update_kpianalysis(
    obj_uuid: str,
    data: KPIAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新KPI分析"""
    try:
        return await KPIAnalysisService.update_kpianalysis(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除KPI分析")
async def delete_kpianalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除KPI分析（软删除）"""
    try:
        await KPIAnalysisService.delete_kpianalysis(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
