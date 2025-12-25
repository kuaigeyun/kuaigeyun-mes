"""
安全隐患 API 模块

提供安全隐患的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.safety_hazard_service import SafetyHazardService
from apps.kuaiehs.schemas.safety_hazard_schemas import (
    SafetyHazardCreate, SafetyHazardUpdate, SafetyHazardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/safety-hazard", tags=["Safety Hazards"])


@router.post("", response_model=SafetyHazardResponse, summary="创建安全隐患")
async def create_safetyhazard(
    data: SafetyHazardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建安全隐患"""
    try:
        return await SafetyHazardService.create_safetyhazard(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SafetyHazardResponse], summary="获取安全隐患列表")
async def list_safetyhazards(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取安全隐患列表"""
    return await SafetyHazardService.list_safetyhazards(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=SafetyHazardResponse, summary="获取安全隐患详情")
async def get_safetyhazard(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取安全隐患详情"""
    try:
        return await SafetyHazardService.get_safetyhazard_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=SafetyHazardResponse, summary="更新安全隐患")
async def update_safetyhazard(
    obj_uuid: str,
    data: SafetyHazardUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新安全隐患"""
    try:
        return await SafetyHazardService.update_safetyhazard(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除安全隐患")
async def delete_safetyhazard(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除安全隐患（软删除）"""
    try:
        await SafetyHazardService.delete_safetyhazard(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
