"""
目标 API 模块

提供目标的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.objective_service import ObjectiveService
from apps.kuaiepm.schemas.objective_schemas import (
    ObjectiveCreate, ObjectiveUpdate, ObjectiveResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/objective", tags=["目标"])


@router.post("", response_model=ObjectiveResponse, summary="创建目标")
async def create_objective(
    data: ObjectiveCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建目标"""
    try:
        return await ObjectiveService.create_objective(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ObjectiveResponse], summary="获取目标列表")
async def list_objectives(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取目标列表"""
    return await ObjectiveService.list_objectives(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ObjectiveResponse, summary="获取目标详情")
async def get_objective(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取目标详情"""
    try:
        return await ObjectiveService.get_objective_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ObjectiveResponse, summary="更新目标")
async def update_objective(
    obj_uuid: str,
    data: ObjectiveUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新目标"""
    try:
        return await ObjectiveService.update_objective(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除目标")
async def delete_objective(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除目标（软删除）"""
    try:
        await ObjectiveService.delete_objective(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
