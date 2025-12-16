"""
趋势分析 API 模块

提供趋势分析的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.trend_analysis_service import TrendAnalysisService
from apps.kuaiepm.schemas.trend_analysis_schemas import (
    TrendAnalysisCreate, TrendAnalysisUpdate, TrendAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/trend-analysis", tags=["趋势分析"])


@router.post("", response_model=TrendAnalysisResponse, summary="创建趋势分析")
async def create_trendanalysis(
    data: TrendAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建趋势分析"""
    try:
        return await TrendAnalysisService.create_trendanalysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[TrendAnalysisResponse], summary="获取趋势分析列表")
async def list_trendanalysiss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取趋势分析列表"""
    return await TrendAnalysisService.list_trendanalysiss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=TrendAnalysisResponse, summary="获取趋势分析详情")
async def get_trendanalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取趋势分析详情"""
    try:
        return await TrendAnalysisService.get_trendanalysis_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=TrendAnalysisResponse, summary="更新趋势分析")
async def update_trendanalysis(
    obj_uuid: str,
    data: TrendAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新趋势分析"""
    try:
        return await TrendAnalysisService.update_trendanalysis(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除趋势分析")
async def delete_trendanalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除趋势分析（软删除）"""
    try:
        await TrendAnalysisService.delete_trendanalysis(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
