"""
采购订单 API 模块

提供采购订单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaisrm.services.purchase_order_service import PurchaseOrderService
from apps.kuaisrm.schemas.purchase_order_schemas import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED, summary="创建采购订单")
async def create_purchase_order(
    data: PurchaseOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建采购订单
    
    - **order_no**: 订单编号（必填，组织内唯一）
    - **order_date**: 订单日期（必填）
    - **supplier_id**: 供应商ID（必填）
    - **total_amount**: 订单总金额
    """
    try:
        return await PurchaseOrderService.create_purchase_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[PurchaseOrderResponse], summary="获取采购订单列表")
async def list_purchase_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态（过滤）"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（过滤）")
):
    """
    获取采购订单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 订单状态（可选，用于过滤）
    - **supplier_id**: 供应商ID（可选）
    """
    return await PurchaseOrderService.list_purchase_orders(tenant_id, skip, limit, status, supplier_id)


@router.get("/{order_uuid}", response_model=PurchaseOrderResponse, summary="获取采购订单详情")
async def get_purchase_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取采购订单详情
    
    - **order_uuid**: 订单UUID
    """
    try:
        return await PurchaseOrderService.get_purchase_order_by_uuid(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{order_uuid}", response_model=PurchaseOrderResponse, summary="更新采购订单")
async def update_purchase_order(
    order_uuid: str,
    data: PurchaseOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新采购订单
    
    - **order_uuid**: 订单UUID
    - **data**: 订单更新数据
    """
    try:
        return await PurchaseOrderService.update_purchase_order(tenant_id, order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除采购订单")
async def delete_purchase_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除采购订单（软删除）
    
    - **order_uuid**: 订单UUID
    """
    try:
        await PurchaseOrderService.delete_purchase_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/submit-approval", response_model=PurchaseOrderResponse, summary="提交采购订单审批")
async def submit_for_approval(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    process_code: str = Query(..., description="审批流程代码")
):
    """
    提交采购订单审批
    
    - **order_uuid**: 订单UUID
    - **process_code**: 审批流程代码（如：purchase_order_approval）
    """
    try:
        return await PurchaseOrderService.submit_for_approval(tenant_id, order_uuid, process_code, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
