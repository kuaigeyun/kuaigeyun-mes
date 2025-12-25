"""
销售订单 API 模块

提供销售订单的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.sales_order_service import SalesOrderService
from apps.kuaicrm.schemas.sales_order_schemas import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/sales-orders", tags=["Sales Orders"])


@router.post("", response_model=SalesOrderResponse, summary="创建销售订单")
async def create_sales_order(
    data: SalesOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建销售订单
    
    - **order_no**: 订单编号（必填，组织内唯一）
    - **order_date**: 订单日期（必填）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **opportunity_id**: 关联商机ID（可选）
    - **total_amount**: 订单金额（必填）
    - **delivery_date**: 交期要求（可选）
    - **priority**: 优先级（默认：普通）
    """
    try:
        return await SalesOrderService.create_sales_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SalesOrderResponse], summary="获取销售订单列表")
async def list_sales_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取销售订单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 订单状态（可选，用于过滤）
    - **customer_id**: 客户ID（可选）
    """
    return await SalesOrderService.list_sales_orders(tenant_id, skip, limit, status, customer_id)


@router.get("/{order_uuid}", response_model=SalesOrderResponse, summary="获取销售订单详情")
async def get_sales_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取销售订单详情
    
    - **order_uuid**: 订单UUID
    """
    try:
        return await SalesOrderService.get_sales_order_by_uuid(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{order_uuid}", response_model=SalesOrderResponse, summary="更新销售订单")
async def update_sales_order(
    order_uuid: str,
    data: SalesOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新销售订单
    
    - **order_uuid**: 订单UUID
    - **data**: 订单更新数据
    """
    try:
        return await SalesOrderService.update_sales_order(tenant_id, order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{order_uuid}/tracking", summary="订单跟踪")
async def track_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    订单跟踪
    
    - **order_uuid**: 订单UUID
    
    返回订单跟踪信息（状态历史、进度信息）
    """
    try:
        return await SalesOrderService.track_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/change", response_model=SalesOrderResponse, summary="订单变更")
async def change_order(
    order_uuid: str,
    change_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    change_reason: str = Query(..., description="变更原因")
):
    """
    订单变更
    
    - **order_uuid**: 订单UUID
    - **change_data**: 变更数据（JSON格式）
    - **change_reason**: 变更原因
    """
    try:
        return await SalesOrderService.change_order(tenant_id, order_uuid, change_data, change_reason)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/deliver", response_model=SalesOrderResponse, summary="订单交付")
async def deliver_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    订单交付
    
    - **order_uuid**: 订单UUID
    """
    try:
        return await SalesOrderService.deliver_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/submit-approval", response_model=SalesOrderResponse, summary="提交订单审批")
async def submit_for_approval(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    process_code: str = Query(..., description="审批流程代码")
):
    """
    提交订单审批
    
    - **order_uuid**: 订单UUID
    - **process_code**: 审批流程代码（如：sales_order_approval）
    """
    try:
        return await SalesOrderService.submit_for_approval(tenant_id, order_uuid, process_code, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{order_uuid}/approval-status", summary="获取订单审批状态")
async def get_approval_status(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取订单审批状态
    
    - **order_uuid**: 订单UUID
    
    返回审批状态、审批实例信息、审批历史等
    """
    try:
        return await SalesOrderService.get_approval_status(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{order_uuid}/cancel-approval", response_model=SalesOrderResponse, summary="取消订单审批")
async def cancel_approval(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    取消订单审批
    
    - **order_uuid**: 订单UUID
    
    只能取消待审批状态的订单
    """
    try:
        return await SalesOrderService.cancel_approval(tenant_id, order_uuid, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除销售订单")
async def delete_sales_order(
    order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除销售订单（软删除）
    
    - **order_uuid**: 订单UUID
    """
    try:
        await SalesOrderService.delete_sales_order(tenant_id, order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
