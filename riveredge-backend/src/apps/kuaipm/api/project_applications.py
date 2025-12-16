"""
项目申请 API 模块

提供项目申请的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_application_service import ProjectApplicationService
from apps.kuaipm.schemas.project_application_schemas import (
    ProjectApplicationCreate, ProjectApplicationUpdate, ProjectApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-application", tags=["项目申请"])


@router.post("", response_model=ProjectApplicationResponse, summary="创建项目申请")
async def create_projectapplication(
    data: ProjectApplicationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目申请"""
    try:
        return await ProjectApplicationService.create_projectapplication(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectApplicationResponse], summary="获取项目申请列表")
async def list_projectapplications(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目申请列表"""
    return await ProjectApplicationService.list_projectapplications(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectApplicationResponse, summary="获取项目申请详情")
async def get_projectapplication(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目申请详情"""
    try:
        return await ProjectApplicationService.get_projectapplication_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectApplicationResponse, summary="更新项目申请")
async def update_projectapplication(
    obj_uuid: str,
    data: ProjectApplicationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目申请"""
    try:
        return await ProjectApplicationService.update_projectapplication(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目申请")
async def delete_projectapplication(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目申请（软删除）"""
    try:
        await ProjectApplicationService.delete_projectapplication(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
