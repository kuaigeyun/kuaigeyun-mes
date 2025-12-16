"""
项目资源 API 模块

提供项目资源的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_resource_service import ProjectResourceService
from apps.kuaipm.schemas.project_resource_schemas import (
    ProjectResourceCreate, ProjectResourceUpdate, ProjectResourceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-resource", tags=["项目资源"])


@router.post("", response_model=ProjectResourceResponse, summary="创建项目资源")
async def create_projectresource(
    data: ProjectResourceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目资源"""
    try:
        return await ProjectResourceService.create_projectresource(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectResourceResponse], summary="获取项目资源列表")
async def list_projectresources(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目资源列表"""
    return await ProjectResourceService.list_projectresources(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectResourceResponse, summary="获取项目资源详情")
async def get_projectresource(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目资源详情"""
    try:
        return await ProjectResourceService.get_projectresource_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectResourceResponse, summary="更新项目资源")
async def update_projectresource(
    obj_uuid: str,
    data: ProjectResourceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目资源"""
    try:
        return await ProjectResourceService.update_projectresource(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目资源")
async def delete_projectresource(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目资源（软删除）"""
    try:
        await ProjectResourceService.delete_projectresource(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
