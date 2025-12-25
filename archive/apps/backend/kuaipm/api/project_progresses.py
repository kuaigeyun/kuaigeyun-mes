"""
项目进度 API 模块

提供项目进度的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_progress_service import ProjectProgressService
from apps.kuaipm.schemas.project_progress_schemas import (
    ProjectProgressCreate, ProjectProgressUpdate, ProjectProgressResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-progresses", tags=["Project Progress"])


@router.post("", response_model=ProjectProgressResponse, summary="创建项目进度")
async def create_projectprogress(
    data: ProjectProgressCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目进度"""
    try:
        return await ProjectProgressService.create_projectprogress(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectProgressResponse], summary="获取项目进度列表")
async def list_projectprogresss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目进度列表"""
    return await ProjectProgressService.list_projectprogresss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectProgressResponse, summary="获取项目进度详情")
async def get_projectprogress(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目进度详情"""
    try:
        return await ProjectProgressService.get_projectprogress_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectProgressResponse, summary="更新项目进度")
async def update_projectprogress(
    obj_uuid: str,
    data: ProjectProgressUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目进度"""
    try:
        return await ProjectProgressService.update_projectprogress(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目进度")
async def delete_projectprogress(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目进度（软删除）"""
    try:
        await ProjectProgressService.delete_projectprogress(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
