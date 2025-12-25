"""
对比分析 API 模块

提供对比分析的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.comparison_analysis_service import ComparisonAnalysisService
from apps.kuaiepm.schemas.comparison_analysis_schemas import (
    ComparisonAnalysisCreate, ComparisonAnalysisUpdate, ComparisonAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/comparison-analysis", tags=["Comparison Analysis"])


@router.post("", response_model=ComparisonAnalysisResponse, summary="创建对比分析")
async def create_comparisonanalysis(
    data: ComparisonAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建对比分析"""
    try:
        return await ComparisonAnalysisService.create_comparisonanalysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ComparisonAnalysisResponse], summary="获取对比分析列表")
async def list_comparisonanalysiss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取对比分析列表"""
    return await ComparisonAnalysisService.list_comparisonanalysiss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ComparisonAnalysisResponse, summary="获取对比分析详情")
async def get_comparisonanalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取对比分析详情"""
    try:
        return await ComparisonAnalysisService.get_comparisonanalysis_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ComparisonAnalysisResponse, summary="更新对比分析")
async def update_comparisonanalysis(
    obj_uuid: str,
    data: ComparisonAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新对比分析"""
    try:
        return await ComparisonAnalysisService.update_comparisonanalysis(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除对比分析")
async def delete_comparisonanalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除对比分析（软删除）"""
    try:
        await ComparisonAnalysisService.delete_comparisonanalysis(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
