"""
项目 API 模块

提供项目的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_service import ProjectService
from apps.kuaipm.schemas.project_schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/projects", tags=["项目"])


@router.post("", response_model=ProjectResponse, summary="创建项目")
async def create_project(
    data: ProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目"""
    try:
        return await ProjectService.create_project(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectResponse], summary="获取项目列表")
async def list_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    manager_id: Optional[int] = Query(None)
):
    """获取项目列表"""
    return await ProjectService.list_projects(
        tenant_id, skip, limit, project_type, status, manager_id
    )


@router.get("/{project_uuid}", response_model=ProjectResponse, summary="获取项目详情")
async def get_project(
    project_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目详情"""
    try:
        return await ProjectService.get_project_by_uuid(tenant_id, project_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{project_uuid}", response_model=ProjectResponse, summary="更新项目")
async def update_project(
    project_uuid: str,
    data: ProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目"""
    try:
        return await ProjectService.update_project(tenant_id, project_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{project_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目")
async def delete_project(
    project_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目（软删除）"""
    try:
        await ProjectService.delete_project(tenant_id, project_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

