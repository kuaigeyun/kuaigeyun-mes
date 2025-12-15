"""
运输计划 API 模块

提供运输计划的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaitms.services.transport_plan_service import TransportPlanService
from apps.kuaitms.schemas.transport_plan_schemas import (
    TransportPlanCreate, TransportPlanUpdate, TransportPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/transport-plans", tags=["TransportPlans"])


@router.post("", response_model=TransportPlanResponse, status_code=status.HTTP_201_CREATED, summary="创建运输计划")
async def create_transport_plan(
    data: TransportPlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建运输计划"""
    try:
        return await TransportPlanService.create_transport_plan(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[TransportPlanResponse], summary="获取运输计划列表")
async def list_transport_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="计划状态（过滤）"),
    vehicle_id: Optional[int] = Query(None, description="车辆ID（过滤）")
):
    """获取运输计划列表"""
    return await TransportPlanService.list_transport_plans(tenant_id, skip, limit, status, vehicle_id)


@router.get("/{plan_uuid}", response_model=TransportPlanResponse, summary="获取运输计划详情")
async def get_transport_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取运输计划详情"""
    try:
        return await TransportPlanService.get_transport_plan_by_uuid(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{plan_uuid}", response_model=TransportPlanResponse, summary="更新运输计划")
async def update_transport_plan(
    plan_uuid: str,
    data: TransportPlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新运输计划"""
    try:
        return await TransportPlanService.update_transport_plan(tenant_id, plan_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{plan_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除运输计划")
async def delete_transport_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除运输计划"""
    try:
        await TransportPlanService.delete_transport_plan(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

