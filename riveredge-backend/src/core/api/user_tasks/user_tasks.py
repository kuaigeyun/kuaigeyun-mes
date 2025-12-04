"""
用户任务管理 API 路由

提供用户任务的查询、处理等功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict

from core.schemas.user_task import (
    UserTaskResponse,
    UserTaskListResponse,
    UserTaskStatsResponse,
    UserTaskActionRequest,
)
from core.services.user_task_service import UserTaskService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/user-tasks", tags=["UserTasks"])


@router.get("", response_model=UserTaskListResponse)
async def get_user_tasks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: str = Query(None, description="任务状态过滤（pending、approved、rejected、cancelled）"),
    task_type: str = Query(None, description="任务类型（pending=待处理, submitted=我提交的）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户任务列表
    
    Args:
        page: 页码
        page_size: 每页数量
        status: 任务状态过滤
        task_type: 任务类型（pending=待处理, submitted=我提交的）
        
    Returns:
        UserTaskListResponse: 用户任务列表
    """
    return await UserTaskService.get_user_tasks(
        tenant_id=tenant_id,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
        task_type=task_type,
    )


@router.get("/stats", response_model=UserTaskStatsResponse)
async def get_user_task_stats(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户任务统计
    
    Returns:
        UserTaskStatsResponse: 用户任务统计
    """
    return await UserTaskService.get_user_task_stats(
        tenant_id=tenant_id,
        user_id=current_user.id,
    )


@router.get("/{task_uuid}", response_model=UserTaskResponse)
async def get_user_task(
    task_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户任务详情
    
    Args:
        task_uuid: 任务UUID
        
    Returns:
        UserTaskResponse: 用户任务对象
        
    Raises:
        HTTPException: 当任务不存在时抛出
    """
    try:
        return await UserTaskService.get_user_task(
            tenant_id=tenant_id,
            user_id=current_user.id,
            task_uuid=task_uuid,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{task_uuid}/process", response_model=UserTaskResponse)
async def process_user_task(
    task_uuid: str,
    data: UserTaskActionRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    处理用户任务（审批或拒绝）
    
    Args:
        task_uuid: 任务UUID
        data: 任务操作数据
        
    Returns:
        UserTaskResponse: 更新后的任务对象
        
    Raises:
        HTTPException: 当任务不存在或操作无效时抛出
    """
    try:
        return await UserTaskService.process_user_task(
            tenant_id=tenant_id,
            user_id=current_user.id,
            task_uuid=task_uuid,
            data=data,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

