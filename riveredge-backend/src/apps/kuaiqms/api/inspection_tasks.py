"""
质量检验任务 API 模块

提供质量检验任务的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.inspection_task_service import InspectionTaskService
from apps.kuaiqms.schemas.inspection_task_schemas import (
    InspectionTaskCreate, InspectionTaskUpdate, InspectionTaskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/inspection-tasks", tags=["InspectionTasks"])


@router.post("", response_model=InspectionTaskResponse, status_code=status.HTTP_201_CREATED, summary="创建质量检验任务")
async def create_inspection_task(
    data: InspectionTaskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建质量检验任务"""
    try:
        return await InspectionTaskService.create_inspection_task(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[InspectionTaskResponse], summary="获取质量检验任务列表")
async def list_inspection_tasks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    inspection_type: Optional[str] = Query(None, description="检验类型（过滤）"),
    status: Optional[str] = Query(None, description="任务状态（过滤）")
):
    """获取质量检验任务列表"""
    return await InspectionTaskService.list_inspection_tasks(tenant_id, skip, limit, inspection_type, status)


@router.get("/{task_uuid}", response_model=InspectionTaskResponse, summary="获取质量检验任务详情")
async def get_inspection_task(
    task_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取质量检验任务详情"""
    try:
        return await InspectionTaskService.get_inspection_task_by_uuid(tenant_id, task_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{task_uuid}", response_model=InspectionTaskResponse, summary="更新质量检验任务")
async def update_inspection_task(
    task_uuid: str,
    data: InspectionTaskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新质量检验任务"""
    try:
        return await InspectionTaskService.update_inspection_task(tenant_id, task_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{task_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除质量检验任务")
async def delete_inspection_task(
    task_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除质量检验任务"""
    try:
        await InspectionTaskService.delete_inspection_task(tenant_id, task_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
