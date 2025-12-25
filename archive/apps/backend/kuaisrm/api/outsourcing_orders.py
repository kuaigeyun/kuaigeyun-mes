"""
委外订单 API 模块

提供委外订单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaisrm.services.outsourcing_order_service import OutsourcingOrderService
from apps.kuaisrm.schemas.outsourcing_order_schemas import (
    OutsourcingOrderCreate, OutsourcingOrderUpdate, OutsourcingOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/outsourcing-orders", tags=["Outsourcing Orders"])


@router.post("", response_model=OutsourcingOrderResponse, status_code=status.HTTP_201_CREATED, summary="创建委外订单")
async def create_outsourcing_order(
    data: OutsourcingOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建委外订单
    
    - **order_no**: 订单编号（必填，组织内唯一）
    - **order_date**: 订单日期（必填）
    - **supplier_id**: 委外供应商ID（必填）
    - **total_amount**: 订单总金额
    """
    try:
        return await OutsourcingOrderService.create_outsourcing_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OutsourcingOrderResponse], summary="获取委外订单列表")
async def list_outsourcing_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态（过滤）"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（过滤）")
):
    """
    获取委外订单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 订单状态（可选，用于过滤）
    - **supplier_id**: 供应商ID（可选）
    """
    return await OutsourcingOrderService.list_outsourcing_orders(tenant_id, skip, limit, status, supplier_id)


@router.get("/{order_uuid}", response_model=OutsourcingOrderResponse, summary="获取委外订单详情")
async def get_outsourcing_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取委外订单详情
    
    - **order_uuid**: 订单UUID
    """
    try:
        return await OutsourcingOrderService.get_outsourcing_order_by_uuid(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{order_uuid}", response_model=OutsourcingOrderResponse, summary="更新委外订单")
async def update_outsourcing_order(
    order_uuid: str,
    data: OutsourcingOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新委外订单
    
    - **order_uuid**: 订单UUID
    - **data**: 订单更新数据
    """
    try:
        return await OutsourcingOrderService.update_outsourcing_order(tenant_id, order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除委外订单")
async def delete_outsourcing_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除委外订单（软删除）
    
    - **order_uuid**: 订单UUID
    """
    try:
        await OutsourcingOrderService.delete_outsourcing_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/update-progress", response_model=OutsourcingOrderResponse, summary="更新委外订单进度")
async def update_progress(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    progress: int = Query(..., ge=0, le=100, description="完成进度（0-100）")
):
    """
    更新委外订单进度
    
    - **order_uuid**: 订单UUID
    - **progress**: 完成进度（0-100）
    """
    try:
        return await OutsourcingOrderService.update_progress(tenant_id, order_uuid, progress)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
