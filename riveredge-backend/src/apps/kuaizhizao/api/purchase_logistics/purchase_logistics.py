"""
采购物流记录 API 路由模块

Author: RiverEdge Team
Date: 2026-03-04
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status as http_status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

from apps.kuaizhizao.services.purchase_logistics_service import PurchaseLogisticsService
from apps.kuaizhizao.schemas.purchase_logistics import (
    PurchaseLogisticsCreate,
    PurchaseLogisticsUpdate,
    PurchaseLogisticsResponse,
)

purchase_logistics_service = PurchaseLogisticsService()
router = APIRouter(prefix="/purchase-logistics", tags=["Kuaige Zhizao - Purchase Logistics"])


@router.post("", response_model=PurchaseLogisticsResponse, summary="创建采购物流记录")
async def create_purchase_logistics(
    data: PurchaseLogisticsCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建采购物流记录"""
    try:
        return await purchase_logistics_service.create_logistics(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id,
        )
    except Exception as e:
        logger.error("创建采购物流记录失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建采购物流记录失败",
        )


@router.get("", response_model=List[PurchaseLogisticsResponse], summary="获取采购物流记录列表")
async def list_purchase_logistics(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    purchase_order_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    tracking_number: Optional[str] = Query(None),
    carrier: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取采购物流记录列表"""
    return await purchase_logistics_service.list_logistics(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        purchase_order_id=purchase_order_id,
        supplier_id=supplier_id,
        tracking_number=tracking_number,
        carrier=carrier,
        status=status,
    )


@router.get("/{logistics_id}", response_model=PurchaseLogisticsResponse, summary="获取采购物流记录详情")
async def get_purchase_logistics(
    logistics_id: int = Path(..., description="物流记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取采购物流记录详情"""
    try:
        return await purchase_logistics_service.get_by_id(
            tenant_id=tenant_id,
            logistics_id=logistics_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{logistics_id}", response_model=PurchaseLogisticsResponse, summary="更新采购物流记录")
async def update_purchase_logistics(
    logistics_id: int = Path(..., description="物流记录ID"),
    data: PurchaseLogisticsUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新采购物流记录"""
    try:
        return await purchase_logistics_service.update_logistics(
            tenant_id=tenant_id,
            logistics_id=logistics_id,
            data=data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{logistics_id}", summary="删除采购物流记录")
async def delete_purchase_logistics(
    logistics_id: int = Path(..., description="物流记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除采购物流记录"""
    try:
        await purchase_logistics_service.delete_logistics(
            tenant_id=tenant_id,
            logistics_id=logistics_id,
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
