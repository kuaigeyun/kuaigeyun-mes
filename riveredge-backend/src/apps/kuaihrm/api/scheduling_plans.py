"""
排班计划 API 模块

提供排班计划的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.scheduling_plan_service import SchedulingPlanService
from apps.kuaihrm.schemas.scheduling_plan_schemas import (
    SchedulingPlanCreate, SchedulingPlanUpdate, SchedulingPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scheduling-plans", tags=["排班计划"])


@router.post("", response_model=SchedulingPlanResponse, summary="创建排班计划")
async def create_scheduling_plan(
    data: SchedulingPlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建排班计划"""
    try:
        return await SchedulingPlanService.create_scheduling_plan(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SchedulingPlanResponse], summary="获取排班计划列表")
async def list_scheduling_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    plan_period: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取排班计划列表"""
    return await SchedulingPlanService.list_scheduling_plans(
        tenant_id, skip, limit, department_id, plan_period, status
    )


@router.get("/{plan_uuid}", response_model=SchedulingPlanResponse, summary="获取排班计划详情")
async def get_scheduling_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取排班计划详情"""
    try:
        return await SchedulingPlanService.get_scheduling_plan_by_uuid(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{plan_uuid}", response_model=SchedulingPlanResponse, summary="更新排班计划")
async def update_scheduling_plan(
    plan_uuid: str,
    data: SchedulingPlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新排班计划"""
    try:
        return await SchedulingPlanService.update_scheduling_plan(tenant_id, plan_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{plan_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除排班计划")
async def delete_scheduling_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除排班计划（软删除）"""
    try:
        await SchedulingPlanService.delete_scheduling_plan(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

