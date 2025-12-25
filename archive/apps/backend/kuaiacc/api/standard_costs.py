"""
标准成本 API 模块

提供标准成本的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.standard_cost_service import StandardCostService
from apps.kuaiacc.schemas.standard_cost_schemas import (
    StandardCostCreate, StandardCostUpdate, StandardCostResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/standard-costs", tags=["Standard Costs"])


@router.post("", response_model=StandardCostResponse, summary="创建标准成本")
async def create_standard_cost(
    data: StandardCostCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建标准成本"""
    try:
        return await StandardCostService.create_standard_cost(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[StandardCostResponse], summary="获取标准成本列表")
async def list_standard_costs(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    material_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取标准成本列表"""
    return await StandardCostService.list_standard_costs(tenant_id, skip, limit, material_id, status)


@router.get("/{uuid}", response_model=StandardCostResponse, summary="获取标准成本详情")
async def get_standard_cost(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取标准成本详情"""
    try:
        return await StandardCostService.get_standard_cost_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=StandardCostResponse, summary="更新标准成本")
async def update_standard_cost(
    uuid: str,
    data: StandardCostUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新标准成本"""
    try:
        return await StandardCostService.update_standard_cost(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除标准成本")
async def delete_standard_cost(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除标准成本（软删除）"""
    try:
        await StandardCostService.delete_standard_cost(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

