"""
排放管理 API 模块

提供排放管理的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.emission_management_service import EmissionManagementService
from apps.kuaiehs.schemas.emission_management_schemas import (
    EmissionManagementCreate, EmissionManagementUpdate, EmissionManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/emission-management", tags=["Emission Management"])


@router.post("", response_model=EmissionManagementResponse, summary="创建排放管理")
async def create_emissionmanagement(
    data: EmissionManagementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建排放管理"""
    try:
        return await EmissionManagementService.create_emissionmanagement(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EmissionManagementResponse], summary="获取排放管理列表")
async def list_emissionmanagements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取排放管理列表"""
    return await EmissionManagementService.list_emissionmanagements(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=EmissionManagementResponse, summary="获取排放管理详情")
async def get_emissionmanagement(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取排放管理详情"""
    try:
        return await EmissionManagementService.get_emissionmanagement_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=EmissionManagementResponse, summary="更新排放管理")
async def update_emissionmanagement(
    obj_uuid: str,
    data: EmissionManagementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新排放管理"""
    try:
        return await EmissionManagementService.update_emissionmanagement(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除排放管理")
async def delete_emissionmanagement(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除排放管理（软删除）"""
    try:
        await EmissionManagementService.delete_emissionmanagement(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
