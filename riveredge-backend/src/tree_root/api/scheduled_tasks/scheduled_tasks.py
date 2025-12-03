"""
定时任务管理 API 路由

提供定时任务的 CRUD 操作和启动/停止功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from tree_root.schemas.scheduled_task import (
    ScheduledTaskCreate,
    ScheduledTaskUpdate,
    ScheduledTaskResponse,
)
from tree_root.services.scheduled_task_service import ScheduledTaskService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user as soil_get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scheduled-tasks", tags=["ScheduledTasks"])


@router.post("", response_model=ScheduledTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_task(
    data: ScheduledTaskCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建定时任务
    
    创建新的定时任务并自动注册到 Inngest（如果启用）。
    
    Args:
        data: 定时任务创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScheduledTaskResponse: 创建的定时任务对象
        
    Raises:
        HTTPException: 当任务代码已存在时抛出
    """
    try:
        scheduled_task = await ScheduledTaskService.create_scheduled_task(
            tenant_id=tenant_id,
            data=data
        )
        return ScheduledTaskResponse.model_validate(scheduled_task)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ScheduledTaskResponse])
async def list_scheduled_tasks(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="任务类型（可选）"),
    trigger_type: Optional[str] = Query(None, description="触发器类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取定时任务列表
    
    获取当前组织的定时任务列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 任务类型（可选）
        trigger_type: 触发器类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ScheduledTaskResponse]: 定时任务列表
    """
    scheduled_tasks = await ScheduledTaskService.list_scheduled_tasks(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        trigger_type=trigger_type,
        is_active=is_active
    )
    return [ScheduledTaskResponse.model_validate(st) for st in scheduled_tasks]


@router.get("/{uuid}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取定时任务详情
    
    根据UUID获取定时任务的详细信息。
    
    Args:
        uuid: 定时任务UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScheduledTaskResponse: 定时任务对象
        
    Raises:
        HTTPException: 当定时任务不存在时抛出
    """
    try:
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ScheduledTaskResponse.model_validate(scheduled_task)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ScheduledTaskResponse)
async def update_scheduled_task(
    uuid: str,
    data: ScheduledTaskUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新定时任务
    
    更新定时任务信息，如果触发器配置或任务配置发生变化，自动更新 Inngest 函数。
    
    Args:
        uuid: 定时任务UUID
        data: 定时任务更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScheduledTaskResponse: 更新后的定时任务对象
        
    Raises:
        HTTPException: 当定时任务不存在时抛出
    """
    try:
        scheduled_task = await ScheduledTaskService.update_scheduled_task(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ScheduledTaskResponse.model_validate(scheduled_task)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_task(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除定时任务（软删除）
    
    删除定时任务，自动从 Inngest 注销。
    
    Args:
        uuid: 定时任务UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当定时任务不存在时抛出
    """
    try:
        await ScheduledTaskService.delete_scheduled_task(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/start", response_model=ScheduledTaskResponse)
async def start_scheduled_task(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    启动定时任务
    
    将任务注册到 Inngest 并启用。
    
    Args:
        uuid: 定时任务UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScheduledTaskResponse: 更新后的定时任务对象
        
    Raises:
        HTTPException: 当定时任务不存在时抛出
    """
    try:
        scheduled_task = await ScheduledTaskService.start_scheduled_task(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ScheduledTaskResponse.model_validate(scheduled_task)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/stop", response_model=ScheduledTaskResponse)
async def stop_scheduled_task(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    停止定时任务
    
    从 Inngest 注销任务并禁用。
    
    Args:
        uuid: 定时任务UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScheduledTaskResponse: 更新后的定时任务对象
        
    Raises:
        HTTPException: 当定时任务不存在时抛出
    """
    try:
        scheduled_task = await ScheduledTaskService.stop_scheduled_task(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ScheduledTaskResponse.model_validate(scheduled_task)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

