"""
收货通知单管理 API 路由模块

采购通知仓库收货，不直接动库存。

Author: RiverEdge Team
Date: 2026-02-22
"""

import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException as FastAPIHTTPException, status as http_status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError

from apps.kuaizhizao.services.receipt_notice_service import (
    ReceiptNoticeService,
    RECEIPT_NOTICE_SORTABLE_FIELDS,
)
from apps.kuaizhizao.schemas.receipt_notice import (
    ReceiptNoticeCreate,
    ReceiptNoticeUpdate,
    ReceiptNoticeResponse,
    ReceiptNoticeListResponse,
    ReceiptNoticeListPaginatedResponse,
    ReceiptNoticeWithItemsResponse,
    ReceiptNoticeStatisticsResponse,
)

receipt_notice_service = ReceiptNoticeService()
router = APIRouter(prefix="/receipt-notices", tags=["App - Kuaige Zhizao - Receipt Notice"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/receipt-notices",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_receipt_notices_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: str, **kwargs) -> FastAPIHTTPException:
    return _http_exception_with_trace(status_code, str(detail))


@router.post("", response_model=ReceiptNoticeResponse, summary="Create receipt notice")
async def create_receipt_notice(
    notice_data: ReceiptNoticeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建收货通知单，通知单编码自动生成"""
    try:
        return await receipt_notice_service.create_receipt_notice(
            tenant_id=tenant_id,
            notice_data=notice_data,
            created_by=current_user.id,
        )
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建收货通知单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建收货通知单失败",
        )


@router.get("", response_model=ReceiptNoticeListPaginatedResponse, summary="List receipt notices")
async def list_receipt_notices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    status: Optional[str] = Query(None),
    purchase_order_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None, description="模糊：通知单号/采购订单/供应商/仓库/入库单号/物料"),
    include_items: bool = Query(False, description="是否附带通知明细（明细表格视图）"),
    notice_code: Optional[str] = Query(None),
    purchase_order_code: Optional[str] = Query(None),
    planned_start_date: Optional[date] = Query(None),
    planned_end_date: Optional[date] = Query(None),
    created_start_date: Optional[date] = Query(None),
    created_end_date: Optional[date] = Query(None),
    order_by: Optional[str] = Query(None, description="排序字段，如 created_at、-planned_receipt_date"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取收货通知单列表"""
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in RECEIPT_NOTICE_SORTABLE_FIELDS:
            safe_order_by = order_by
    return await receipt_notice_service.list_receipt_notices(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        purchase_order_id=purchase_order_id,
        supplier_id=supplier_id,
        warehouse_id=warehouse_id,
        keyword=keyword,
        notice_code=notice_code,
        purchase_order_code=purchase_order_code,
        planned_start_date=planned_start_date,
        planned_end_date=planned_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        order_by=safe_order_by,
        include_items=include_items,
    )


@router.get("/statistics", response_model=ReceiptNoticeStatisticsResponse, summary="Receipt notice statistics")
async def get_receipt_notice_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """收货通知单 KPI：按 status GROUP BY COUNT。"""
    return await receipt_notice_service.get_receipt_notice_statistics(tenant_id)


# 固定子路径需注册在 /{notice_id} 之前，避免个别 ASGI/匹配顺序下误配
@router.get("/{notice_id}/notify/preview", summary="Preview notify warehouse")
async def preview_notify_warehouse(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """通知仓库预览：返回明细数量、已入库、可通知量，不实际创建采购入库单。"""
    try:
        return await receipt_notice_service.preview_notify_warehouse(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("通知仓库预览失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="通知仓库预览失败",
        )


@router.post("/{notice_id}/notify", response_model=ReceiptNoticeResponse, summary="Notify warehouse")
async def notify_warehouse(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """通知仓库（标记为已通知）"""
    try:
        return await receipt_notice_service.notify_warehouse(
            tenant_id=tenant_id,
            notice_id=notice_id,
            notified_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{notice_id}/withdraw", response_model=ReceiptNoticeResponse, summary="Withdraw notice")
async def withdraw_receipt_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """撤回通知（已通知 -> 待收货），并软删通知生成的采购入库草稿"""
    try:
        return await receipt_notice_service.withdraw_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
            withdrawn_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{notice_id}", response_model=ReceiptNoticeWithItemsResponse, summary="Get receipt notice")
async def get_receipt_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取收货通知单详情（含明细）"""
    try:
        return await receipt_notice_service.get_receipt_notice_by_id(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{notice_id}", response_model=ReceiptNoticeResponse, summary="Update receipt notice")
async def update_receipt_notice(
    notice_id: int = Path(..., description="通知单ID"),
    notice_data: ReceiptNoticeUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新收货通知单，仅待收货状态可更新"""
    try:
        return await receipt_notice_service.update_receipt_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
            notice_data=notice_data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{notice_id}", summary="Delete receipt notice")
async def delete_receipt_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除收货通知单，仅待收货状态可删除"""
    try:
        await receipt_notice_service.delete_receipt_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
