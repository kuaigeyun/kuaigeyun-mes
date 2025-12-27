"""
产能规划 API 模块

提供产能规划的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiaps.services.capacity_planning_service import CapacityPlanningService
from apps.kuaiaps.schemas.capacity_planning_schemas import (
    CapacityPlanningCreate, CapacityPlanningUpdate, CapacityPlanningResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/capacity-plannings", tags=["CapacityPlannings"])


@router.post("", response_model=CapacityPlanningResponse, status_code=status.HTTP_201_CREATED, summary="创建产能规划")
async def create_capacity_planning(
    data: CapacityPlanningCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建产能规划"""
    try:
        return await CapacityPlanningService.create_capacity_planning(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CapacityPlanningResponse], summary="获取产能规划列表")
async def list_capacity_plannings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    resource_type: Optional[str] = Query(None, description="资源类型（过滤）"),
    bottleneck_status: Optional[str] = Query(None, description="瓶颈状态（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取产能规划列表"""
    return await CapacityPlanningService.list_capacity_plannings(tenant_id, skip, limit, resource_type, bottleneck_status, status)


@router.get("/{planning_uuid}", response_model=CapacityPlanningResponse, summary="获取产能规划详情")
async def get_capacity_planning(
    planning_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取产能规划详情"""
    try:
        return await CapacityPlanningService.get_capacity_planning_by_uuid(tenant_id, planning_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{planning_uuid}", response_model=CapacityPlanningResponse, summary="更新产能规划")
async def update_capacity_planning(
    planning_uuid: str,
    data: CapacityPlanningUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新产能规划"""
    try:
        return await CapacityPlanningService.update_capacity_planning(tenant_id, planning_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{planning_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除产能规划")
async def delete_capacity_planning(
    planning_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除产能规划"""
    try:
        await CapacityPlanningService.delete_capacity_planning(tenant_id, planning_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

