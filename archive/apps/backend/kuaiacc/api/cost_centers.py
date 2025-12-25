"""
成本中心 API 模块

提供成本中心的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.cost_center_service import CostCenterService
from apps.kuaiacc.schemas.cost_center_schemas import (
    CostCenterCreate, CostCenterUpdate, CostCenterResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/cost-centers", tags=["Cost Centers"])


@router.post("", response_model=CostCenterResponse, summary="创建成本中心")
async def create_cost_center(
    data: CostCenterCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建成本中心"""
    try:
        return await CostCenterService.create_cost_center(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CostCenterResponse], summary="获取成本中心列表")
async def list_cost_centers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    center_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    parent_id: Optional[int] = Query(None)
):
    """获取成本中心列表"""
    return await CostCenterService.list_cost_centers(
        tenant_id, skip, limit, center_type, status, parent_id
    )


@router.get("/{uuid}", response_model=CostCenterResponse, summary="获取成本中心详情")
async def get_cost_center(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取成本中心详情"""
    try:
        return await CostCenterService.get_cost_center_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=CostCenterResponse, summary="更新成本中心")
async def update_cost_center(
    uuid: str,
    data: CostCenterUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新成本中心"""
    try:
        return await CostCenterService.update_cost_center(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除成本中心")
async def delete_cost_center(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除成本中心（软删除）"""
    try:
        await CostCenterService.delete_cost_center(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

