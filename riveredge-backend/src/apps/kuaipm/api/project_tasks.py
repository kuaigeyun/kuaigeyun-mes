"""
项目任务 API 模块

提供项目任务的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_task_service import ProjectTaskService
from apps.kuaipm.schemas.project_task_schemas import (
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-task", tags=["Project Tasks"])


@router.post("", response_model=ProjectTaskResponse, summary="创建项目任务")
async def create_projecttask(
    data: ProjectTaskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目任务"""
    try:
        return await ProjectTaskService.create_projecttask(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectTaskResponse], summary="获取项目任务列表")
async def list_projecttasks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目任务列表"""
    return await ProjectTaskService.list_projecttasks(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectTaskResponse, summary="获取项目任务详情")
async def get_projecttask(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目任务详情"""
    try:
        return await ProjectTaskService.get_projecttask_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectTaskResponse, summary="更新项目任务")
async def update_projecttask(
    obj_uuid: str,
    data: ProjectTaskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目任务"""
    try:
        return await ProjectTaskService.update_projecttask(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目任务")
async def delete_projecttask(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目任务（软删除）"""
    try:
        await ProjectTaskService.delete_projecttask(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
