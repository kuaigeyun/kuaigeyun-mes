"""
发货通知单管理 API 路由模块

销售通知仓库发货，不直接动库存。

Author: RiverEdge Team
Date: 2026-02-22
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status as http_status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService
from apps.kuaizhizao.schemas.shipment_notice import (
    ShipmentNoticeCreate,
    ShipmentNoticeUpdate,
    ShipmentNoticeResponse,
    ShipmentNoticeListResponse,
    ShipmentNoticeWithItemsResponse,
)

shipment_notice_service = ShipmentNoticeService()
router = APIRouter(prefix="/shipment-notices", tags=["Kuaige Zhizao - Shipment Notice"])


@router.post("", response_model=ShipmentNoticeResponse, summary="创建发货通知单")
async def create_shipment_notice(
    notice_data: ShipmentNoticeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建发货通知单，通知单编码自动生成"""
    try:
        return await shipment_notice_service.create_shipment_notice(
            tenant_id=tenant_id,
            notice_data=notice_data,
            created_by=current_user.id,
        )
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建发货通知单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建发货通知单失败",
        )


@router.get("", response_model=List[ShipmentNoticeListResponse], summary="获取发货通知单列表")
async def list_shipment_notices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    sales_order_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取发货通知单列表"""
    return await shipment_notice_service.list_shipment_notices(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
    )


@router.get("/{notice_id}", response_model=ShipmentNoticeWithItemsResponse, summary="获取发货通知单详情")
async def get_shipment_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取发货通知单详情（含明细）"""
    try:
        return await shipment_notice_service.get_shipment_notice_by_id(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{notice_id}", response_model=ShipmentNoticeResponse, summary="更新发货通知单")
async def update_shipment_notice(
    notice_id: int = Path(..., description="通知单ID"),
    notice_data: ShipmentNoticeUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新发货通知单，仅待发货状态可更新"""
    try:
        return await shipment_notice_service.update_shipment_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
            notice_data=notice_data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{notice_id}", summary="删除发货通知单")
async def delete_shipment_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除发货通知单，仅待发货状态可删除"""
    try:
        await shipment_notice_service.delete_shipment_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{notice_id}/notify", response_model=ShipmentNoticeResponse, summary="通知仓库")
async def notify_warehouse(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """通知仓库（标记为已通知）"""
    try:
        return await shipment_notice_service.notify_warehouse(
            tenant_id=tenant_id,
            notice_id=notice_id,
            notified_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
