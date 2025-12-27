"""
维护计划 API 模块

提供维护计划的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.maintenance_plan_service import MaintenancePlanService
from apps.kuaieam.schemas.maintenance_plan_schemas import (
    MaintenancePlanCreate, MaintenancePlanUpdate, MaintenancePlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/maintenance-plans", tags=["MaintenancePlans"])


@router.post("", response_model=MaintenancePlanResponse, status_code=status.HTTP_201_CREATED, summary="创建维护计划")
async def create_maintenance_plan(
    data: MaintenancePlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建维护计划"""
    try:
        return await MaintenancePlanService.create_maintenance_plan(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MaintenancePlanResponse], summary="获取维护计划列表")
async def list_maintenance_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="计划类型（过滤）"),
    status: Optional[str] = Query(None, description="计划状态（过滤）")
):
    """获取维护计划列表"""
    return await MaintenancePlanService.list_maintenance_plans(tenant_id, skip, limit, plan_type, status)


@router.get("/{plan_uuid}", response_model=MaintenancePlanResponse, summary="获取维护计划详情")
async def get_maintenance_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取维护计划详情"""
    try:
        return await MaintenancePlanService.get_maintenance_plan_by_uuid(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{plan_uuid}", response_model=MaintenancePlanResponse, summary="更新维护计划")
async def update_maintenance_plan(
    plan_uuid: str,
    data: MaintenancePlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新维护计划"""
    try:
        return await MaintenancePlanService.update_maintenance_plan(tenant_id, plan_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{plan_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除维护计划")
async def delete_maintenance_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除维护计划"""
    try:
        await MaintenancePlanService.delete_maintenance_plan(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
