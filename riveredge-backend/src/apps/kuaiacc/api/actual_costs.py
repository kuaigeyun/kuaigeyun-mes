"""
实际成本 API 模块

提供实际成本的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.actual_cost_service import ActualCostService
from apps.kuaiacc.schemas.actual_cost_schemas import (
    ActualCostCreate, ActualCostUpdate, ActualCostResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/actual-costs", tags=["实际成本"])


@router.post("", response_model=ActualCostResponse, summary="创建实际成本")
async def create_actual_cost(
    data: ActualCostCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建实际成本"""
    try:
        return await ActualCostService.create_actual_cost(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ActualCostResponse], summary="获取实际成本列表")
async def list_actual_costs(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    material_id: Optional[int] = Query(None),
    cost_period: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取实际成本列表"""
    return await ActualCostService.list_actual_costs(
        tenant_id, skip, limit, material_id, cost_period, status
    )


@router.get("/{uuid}", response_model=ActualCostResponse, summary="获取实际成本详情")
async def get_actual_cost(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取实际成本详情"""
    try:
        return await ActualCostService.get_actual_cost_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=ActualCostResponse, summary="更新实际成本")
async def update_actual_cost(
    uuid: str,
    data: ActualCostUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新实际成本"""
    try:
        return await ActualCostService.update_actual_cost(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除实际成本")
async def delete_actual_cost(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除实际成本（软删除）"""
    try:
        await ActualCostService.delete_actual_cost(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

