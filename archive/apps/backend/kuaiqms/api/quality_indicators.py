"""
质量指标 API 模块

提供质量指标的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.quality_indicator_service import QualityIndicatorService
from apps.kuaiqms.schemas.quality_indicator_schemas import (
    QualityIndicatorCreate, QualityIndicatorUpdate, QualityIndicatorResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/quality-indicators", tags=["QualityIndicators"])


@router.post("", response_model=QualityIndicatorResponse, status_code=status.HTTP_201_CREATED, summary="创建质量指标")
async def create_quality_indicator(
    data: QualityIndicatorCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建质量指标"""
    try:
        return await QualityIndicatorService.create_quality_indicator(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[QualityIndicatorResponse], summary="获取质量指标列表")
async def list_quality_indicators(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    indicator_type: Optional[str] = Query(None, description="指标类型（过滤）"),
    status: Optional[str] = Query(None, description="指标状态（过滤）")
):
    """获取质量指标列表"""
    return await QualityIndicatorService.list_quality_indicators(tenant_id, skip, limit, indicator_type, status)


@router.get("/{indicator_uuid}", response_model=QualityIndicatorResponse, summary="获取质量指标详情")
async def get_quality_indicator(
    indicator_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取质量指标详情"""
    try:
        return await QualityIndicatorService.get_quality_indicator_by_uuid(tenant_id, indicator_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{indicator_uuid}", response_model=QualityIndicatorResponse, summary="更新质量指标")
async def update_quality_indicator(
    indicator_uuid: str,
    data: QualityIndicatorUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新质量指标"""
    try:
        return await QualityIndicatorService.update_quality_indicator(tenant_id, indicator_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{indicator_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除质量指标")
async def delete_quality_indicator(
    indicator_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除质量指标"""
    try:
        await QualityIndicatorService.delete_quality_indicator(tenant_id, indicator_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
