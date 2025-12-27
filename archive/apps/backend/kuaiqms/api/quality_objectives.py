"""
质量目标 API 模块

提供质量目标的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.quality_objective_service import QualityObjectiveService
from apps.kuaiqms.schemas.quality_objective_schemas import (
    QualityObjectiveCreate, QualityObjectiveUpdate, QualityObjectiveResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/quality-objectives", tags=["QualityObjectives"])


@router.post("", response_model=QualityObjectiveResponse, status_code=status.HTTP_201_CREATED, summary="创建质量目标")
async def create_quality_objective(
    data: QualityObjectiveCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建质量目标"""
    try:
        return await QualityObjectiveService.create_quality_objective(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[QualityObjectiveResponse], summary="获取质量目标列表")
async def list_quality_objectives(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    period: Optional[str] = Query(None, description="周期（过滤）"),
    status: Optional[str] = Query(None, description="目标状态（过滤）")
):
    """获取质量目标列表"""
    return await QualityObjectiveService.list_quality_objectives(tenant_id, skip, limit, period, status)


@router.get("/{objective_uuid}", response_model=QualityObjectiveResponse, summary="获取质量目标详情")
async def get_quality_objective(
    objective_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取质量目标详情"""
    try:
        return await QualityObjectiveService.get_quality_objective_by_uuid(tenant_id, objective_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{objective_uuid}", response_model=QualityObjectiveResponse, summary="更新质量目标")
async def update_quality_objective(
    objective_uuid: str,
    data: QualityObjectiveUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新质量目标"""
    try:
        return await QualityObjectiveService.update_quality_objective(tenant_id, objective_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{objective_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除质量目标")
async def delete_quality_objective(
    objective_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除质量目标"""
    try:
        await QualityObjectiveService.delete_quality_objective(tenant_id, objective_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
