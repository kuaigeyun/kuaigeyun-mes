"""
项目质量 API 模块

提供项目质量的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_quality_service import ProjectQualityService
from apps.kuaipm.schemas.project_quality_schemas import (
    ProjectQualityCreate, ProjectQualityUpdate, ProjectQualityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-qualities", tags=["Project Quality"])


@router.post("", response_model=ProjectQualityResponse, summary="创建项目质量")
async def create_projectquality(
    data: ProjectQualityCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目质量"""
    try:
        return await ProjectQualityService.create_projectquality(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectQualityResponse], summary="获取项目质量列表")
async def list_projectqualitys(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目质量列表"""
    return await ProjectQualityService.list_projectqualitys(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectQualityResponse, summary="获取项目质量详情")
async def get_projectquality(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目质量详情"""
    try:
        return await ProjectQualityService.get_projectquality_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectQualityResponse, summary="更新项目质量")
async def update_projectquality(
    obj_uuid: str,
    data: ProjectQualityUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目质量"""
    try:
        return await ProjectQualityService.update_projectquality(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目质量")
async def delete_projectquality(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目质量（软删除）"""
    try:
        await ProjectQualityService.delete_projectquality(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
