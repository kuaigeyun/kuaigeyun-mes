"""
项目WBS API 模块

提供项目WBS的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_wbs_service import ProjectWBSService
from apps.kuaipm.schemas.project_wbs_schemas import (
    ProjectWBSCreate, ProjectWBSUpdate, ProjectWBSResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-wbs", tags=["Project WBS"])


@router.post("", response_model=ProjectWBSResponse, summary="创建项目WBS")
async def create_projectwbs(
    data: ProjectWBSCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目WBS"""
    try:
        return await ProjectWBSService.create_projectwbs(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectWBSResponse], summary="获取项目WBS列表")
async def list_projectwbss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目WBS列表"""
    return await ProjectWBSService.list_projectwbss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectWBSResponse, summary="获取项目WBS详情")
async def get_projectwbs(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目WBS详情"""
    try:
        return await ProjectWBSService.get_projectwbs_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectWBSResponse, summary="更新项目WBS")
async def update_projectwbs(
    obj_uuid: str,
    data: ProjectWBSUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目WBS"""
    try:
        return await ProjectWBSService.update_projectwbs(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目WBS")
async def delete_projectwbs(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目WBS（软删除）"""
    try:
        await ProjectWBSService.delete_projectwbs(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
