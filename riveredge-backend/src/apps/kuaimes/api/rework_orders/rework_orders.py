"""
返修工单 API 模块

提供返修工单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimes.services.rework_order_service import ReworkOrderService
from apps.kuaimes.schemas.rework_order_schemas import (
    ReworkOrderCreate, ReworkOrderUpdate, ReworkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/rework-orders", tags=["Rework Orders"])


@router.post("", response_model=ReworkOrderResponse, status_code=status.HTTP_201_CREATED, summary="创建返修工单")
async def create_rework_order(
    data: ReworkOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建返修工单"""
    try:
        return await ReworkOrderService.create_rework_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ReworkOrderResponse], summary="获取返修工单列表")
async def list_rework_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="返修状态（过滤）")
):
    """获取返修工单列表"""
    return await ReworkOrderService.list_rework_orders(tenant_id, skip, limit, status)


@router.get("/{rework_order_uuid}", response_model=ReworkOrderResponse, summary="获取返修工单详情")
async def get_rework_order(
    rework_order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取返修工单详情"""
    try:
        return await ReworkOrderService.get_rework_order_by_uuid(tenant_id, rework_order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{rework_order_uuid}", response_model=ReworkOrderResponse, summary="更新返修工单")
async def update_rework_order(
    rework_order_uuid: str,
    data: ReworkOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新返修工单"""
    try:
        return await ReworkOrderService.update_rework_order(tenant_id, rework_order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{rework_order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除返修工单")
async def delete_rework_order(
    rework_order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除返修工单（软删除）"""
    try:
        await ReworkOrderService.delete_rework_order(tenant_id, rework_order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
