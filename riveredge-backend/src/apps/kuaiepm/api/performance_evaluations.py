"""
绩效评估 API 模块

提供绩效评估的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.performance_evaluation_service import PerformanceEvaluationService
from apps.kuaiepm.schemas.performance_evaluation_schemas import (
    PerformanceEvaluationCreate, PerformanceEvaluationUpdate, PerformanceEvaluationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/performance-evaluation", tags=["绩效评估"])


@router.post("", response_model=PerformanceEvaluationResponse, summary="创建绩效评估")
async def create_performanceevaluation(
    data: PerformanceEvaluationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建绩效评估"""
    try:
        return await PerformanceEvaluationService.create_performanceevaluation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[PerformanceEvaluationResponse], summary="获取绩效评估列表")
async def list_performanceevaluations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取绩效评估列表"""
    return await PerformanceEvaluationService.list_performanceevaluations(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=PerformanceEvaluationResponse, summary="获取绩效评估详情")
async def get_performanceevaluation(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取绩效评估详情"""
    try:
        return await PerformanceEvaluationService.get_performanceevaluation_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=PerformanceEvaluationResponse, summary="更新绩效评估")
async def update_performanceevaluation(
    obj_uuid: str,
    data: PerformanceEvaluationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新绩效评估"""
    try:
        return await PerformanceEvaluationService.update_performanceevaluation(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除绩效评估")
async def delete_performanceevaluation(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除绩效评估（软删除）"""
    try:
        await PerformanceEvaluationService.delete_performanceevaluation(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
