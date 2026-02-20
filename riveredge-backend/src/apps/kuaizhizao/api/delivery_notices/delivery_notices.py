"""
发货通知单管理 API 路由模块

在销售出库前/后向客户发送发货通知，记录物流信息。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status as http_status
from fastapi.responses import JSONResponse, HTMLResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.delivery_notice_service import DeliveryNoticeService
from apps.kuaizhizao.schemas.delivery_notice import (
    DeliveryNoticeCreate,
    DeliveryNoticeUpdate,
    DeliveryNoticeResponse,
    DeliveryNoticeListResponse,
    DeliveryNoticeWithItemsResponse,
)

delivery_notice_service = DeliveryNoticeService()
router = APIRouter(prefix="/delivery-notices", tags=["Kuaige Zhizao - Delivery Notice"])


@router.post("", response_model=DeliveryNoticeResponse, summary="创建发货通知单")
async def create_delivery_notice(
    notice_data: DeliveryNoticeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建发货通知单，通知单编码自动生成"""
    try:
        return await delivery_notice_service.create_delivery_notice(
            tenant_id=tenant_id,
            notice_data=notice_data,
            created_by=current_user.id,
        )
    except Exception as e:
        logger.error("创建发货通知单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建发货通知单失败",
        )


@router.get("", response_model=List[DeliveryNoticeListResponse], summary="获取发货通知单列表")
async def list_delivery_notices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    sales_delivery_id: Optional[int] = Query(None),
    sales_order_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取发货通知单列表"""
    return await delivery_notice_service.list_delivery_notices(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        sales_delivery_id=sales_delivery_id,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
    )


@router.get("/{notice_id}", response_model=DeliveryNoticeWithItemsResponse, summary="获取发货通知单详情")
async def get_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取发货通知单详情（含明细）"""
    try:
        return await delivery_notice_service.get_delivery_notice_by_id(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{notice_id}", response_model=DeliveryNoticeResponse, summary="更新发货通知单")
async def update_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    notice_data: DeliveryNoticeUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新发货通知单，仅待发送状态可更新"""
    try:
        return await delivery_notice_service.update_delivery_notice(
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
async def delete_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除发货通知单，仅待发送状态可删除"""
    try:
        await delivery_notice_service.delete_delivery_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{notice_id}/send", response_model=DeliveryNoticeResponse, summary="发送通知")
async def send_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """发送发货通知（标记为已发送）"""
    try:
        return await delivery_notice_service.send_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
            sent_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{notice_id}/print", summary="打印发货通知单")
async def print_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印发货通知单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="delivery_notice",
        document_id=notice_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format,
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)
