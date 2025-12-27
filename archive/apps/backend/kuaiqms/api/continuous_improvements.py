"""
持续改进 API 模块

提供持续改进的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.continuous_improvement_service import ContinuousImprovementService
from apps.kuaiqms.schemas.continuous_improvement_schemas import (
    ContinuousImprovementCreate, ContinuousImprovementUpdate, ContinuousImprovementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/continuous-improvements", tags=["ContinuousImprovements"])


@router.post("", response_model=ContinuousImprovementResponse, status_code=status.HTTP_201_CREATED, summary="创建持续改进")
async def create_continuous_improvement(
    data: ContinuousImprovementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建持续改进"""
    try:
        return await ContinuousImprovementService.create_continuous_improvement(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ContinuousImprovementResponse], summary="获取持续改进列表")
async def list_continuous_improvements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    improvement_type: Optional[str] = Query(None, description="改进类型（过滤）"),
    status: Optional[str] = Query(None, description="改进状态（过滤）")
):
    """获取持续改进列表"""
    return await ContinuousImprovementService.list_continuous_improvements(tenant_id, skip, limit, improvement_type, status)


@router.get("/{improvement_uuid}", response_model=ContinuousImprovementResponse, summary="获取持续改进详情")
async def get_continuous_improvement(
    improvement_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取持续改进详情"""
    try:
        return await ContinuousImprovementService.get_continuous_improvement_by_uuid(tenant_id, improvement_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{improvement_uuid}", response_model=ContinuousImprovementResponse, summary="更新持续改进")
async def update_continuous_improvement(
    improvement_uuid: str,
    data: ContinuousImprovementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新持续改进"""
    try:
        return await ContinuousImprovementService.update_continuous_improvement(tenant_id, improvement_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{improvement_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除持续改进")
async def delete_continuous_improvement(
    improvement_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除持续改进"""
    try:
        await ContinuousImprovementService.delete_continuous_improvement(tenant_id, improvement_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
