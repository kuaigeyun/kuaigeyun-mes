"""
入库单 API 模块

提供入库单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiwms.services.inbound_order_service import InboundOrderService
from apps.kuaiwms.schemas.inbound_order_schemas import (
    InboundOrderCreate, InboundOrderUpdate, InboundOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/inbound-orders", tags=["Inbound Orders"])


@router.post("", response_model=InboundOrderResponse, status_code=status.HTTP_201_CREATED, summary="创建入库单")
async def create_inbound_order(
    data: InboundOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建入库单
    
    - **order_no**: 入库单编号（必填，组织内唯一）
    - **order_date**: 入库日期（必填）
    - **order_type**: 入库类型（必填）
    - **warehouse_id**: 仓库ID（必填）
    """
    try:
        return await InboundOrderService.create_inbound_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[InboundOrderResponse], summary="获取入库单列表")
async def list_inbound_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="入库状态（过滤）"),
    order_type: Optional[str] = Query(None, description="入库类型（过滤）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（过滤）")
):
    """
    获取入库单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 入库状态（可选，用于过滤）
    - **order_type**: 入库类型（可选）
    - **warehouse_id**: 仓库ID（可选）
    """
    return await InboundOrderService.list_inbound_orders(tenant_id, skip, limit, status, order_type, warehouse_id)


@router.get("/{order_uuid}", response_model=InboundOrderResponse, summary="获取入库单详情")
async def get_inbound_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取入库单详情
    
    - **order_uuid**: 入库单UUID
    """
    try:
        return await InboundOrderService.get_inbound_order_by_uuid(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{order_uuid}", response_model=InboundOrderResponse, summary="更新入库单")
async def update_inbound_order(
    order_uuid: str,
    data: InboundOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新入库单
    
    - **order_uuid**: 入库单UUID
    - **data**: 入库单更新数据
    """
    try:
        return await InboundOrderService.update_inbound_order(tenant_id, order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除入库单")
async def delete_inbound_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除入库单（软删除）
    
    - **order_uuid**: 入库单UUID
    """
    try:
        await InboundOrderService.delete_inbound_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/confirm", response_model=InboundOrderResponse, summary="确认入库")
async def confirm_inbound(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    确认入库（更新库存）
    
    - **order_uuid**: 入库单UUID
    """
    try:
        return await InboundOrderService.confirm_inbound(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
