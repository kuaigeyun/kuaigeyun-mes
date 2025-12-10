"""
生产订单 API 路由

提供生产订单的 CRUD 操作。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaimes.schemas.order import OrderCreate, OrderUpdate, OrderResponse
from apps.kuaimes.services.order_service import OrderService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/kuaimes/orders", tags=["Kuaimes Orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建生产订单
    
    Args:
        data: 订单创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        OrderResponse: 创建的订单对象
    """
    try:
        order = await OrderService.create_order(
            tenant_id=tenant_id,
            data=data
        )
        return OrderResponse.model_validate(order)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[OrderResponse])
async def list_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取生产订单列表
    
    Args:
        skip: 跳过数量
        limit: 限制数量
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[OrderResponse]: 订单列表
    """
    orders = await OrderService.list_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit
    )
    return [OrderResponse.model_validate(order) for order in orders]


@router.get("/{uuid}", response_model=OrderResponse)
async def get_order(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取生产订单详情
    
    Args:
        uuid: 订单UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        OrderResponse: 订单对象
        
    Raises:
        HTTPException: 当订单不存在时抛出
    """
    try:
        order = await OrderService.get_order_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return OrderResponse.model_validate(order)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

