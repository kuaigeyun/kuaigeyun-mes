"""
生产订单 API 模块

提供生产订单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimes.services.order_service import OrderService
from apps.kuaimes.schemas.order_schemas import (
    OrderCreate, OrderUpdate, OrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, summary="创建生产订单")
async def create_order(
    data: OrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建生产订单"""
    try:
        return await OrderService.create_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OrderResponse], summary="获取生产订单列表")
async def list_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态（过滤）"),
    order_type: Optional[str] = Query(None, description="订单类型（过滤）"),
    product_id: Optional[int] = Query(None, description="产品ID（过滤）")
):
    """获取生产订单列表"""
    return await OrderService.list_orders(tenant_id, skip, limit, status, order_type, product_id)


@router.get("/{order_uuid}", response_model=OrderResponse, summary="获取生产订单详情")
async def get_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取生产订单详情"""
    try:
        return await OrderService.get_order_by_uuid(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{order_uuid}", response_model=OrderResponse, summary="更新生产订单")
async def update_order(
    order_uuid: str,
    data: OrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新生产订单"""
    try:
        return await OrderService.update_order(tenant_id, order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除生产订单")
async def delete_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除生产订单（软删除）"""
    try:
        await OrderService.delete_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/confirm", response_model=OrderResponse, summary="确认生产订单")
async def confirm_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """确认生产订单（下发到车间）"""
    try:
        return await OrderService.confirm_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
