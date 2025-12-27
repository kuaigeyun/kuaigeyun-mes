"""
排班执行 API 模块

提供排班执行的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.scheduling_execution_service import SchedulingExecutionService
from apps.kuaihrm.schemas.scheduling_execution_schemas import (
    SchedulingExecutionCreate, SchedulingExecutionUpdate, SchedulingExecutionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scheduling-executions", tags=["Scheduling Executions"])


@router.post("", response_model=SchedulingExecutionResponse, summary="创建排班执行")
async def create_scheduling_execution(
    data: SchedulingExecutionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建排班执行"""
    try:
        return await SchedulingExecutionService.create_scheduling_execution(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SchedulingExecutionResponse], summary="获取排班执行列表")
async def list_scheduling_executions(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    plan_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取排班执行列表"""
    return await SchedulingExecutionService.list_scheduling_executions(
        tenant_id, skip, limit, plan_id, employee_id, status
    )


@router.get("/{execution_uuid}", response_model=SchedulingExecutionResponse, summary="获取排班执行详情")
async def get_scheduling_execution(
    execution_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取排班执行详情"""
    try:
        return await SchedulingExecutionService.get_scheduling_execution_by_uuid(tenant_id, execution_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{execution_uuid}", response_model=SchedulingExecutionResponse, summary="更新排班执行")
async def update_scheduling_execution(
    execution_uuid: str,
    data: SchedulingExecutionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新排班执行"""
    try:
        return await SchedulingExecutionService.update_scheduling_execution(tenant_id, execution_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{execution_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除排班执行")
async def delete_scheduling_execution(
    execution_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除排班执行（软删除）"""
    try:
        await SchedulingExecutionService.delete_scheduling_execution(tenant_id, execution_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

