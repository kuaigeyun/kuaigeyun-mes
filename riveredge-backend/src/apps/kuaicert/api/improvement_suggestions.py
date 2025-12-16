"""
改进建议 API 模块

提供改进建议的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.improvement_suggestion_service import ImprovementSuggestionService
from apps.kuaicert.schemas.improvement_suggestion_schemas import (
    ImprovementSuggestionCreate, ImprovementSuggestionUpdate, ImprovementSuggestionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/improvement-suggestion", tags=["改进建议"])


@router.post("", response_model=ImprovementSuggestionResponse, summary="创建改进建议")
async def create_improvementsuggestion(
    data: ImprovementSuggestionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建改进建议"""
    try:
        return await ImprovementSuggestionService.create_improvementsuggestion(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ImprovementSuggestionResponse], summary="获取改进建议列表")
async def list_improvementsuggestions(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取改进建议列表"""
    return await ImprovementSuggestionService.list_improvementsuggestions(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ImprovementSuggestionResponse, summary="获取改进建议详情")
async def get_improvementsuggestion(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取改进建议详情"""
    try:
        return await ImprovementSuggestionService.get_improvementsuggestion_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ImprovementSuggestionResponse, summary="更新改进建议")
async def update_improvementsuggestion(
    obj_uuid: str,
    data: ImprovementSuggestionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新改进建议"""
    try:
        return await ImprovementSuggestionService.update_improvementsuggestion(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除改进建议")
async def delete_improvementsuggestion(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除改进建议（软删除）"""
    try:
        await ImprovementSuggestionService.delete_improvementsuggestion(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
