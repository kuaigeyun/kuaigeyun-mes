"""
送货单管理 API 路由模块

在销售出库前/后向客户发送发货通知，记录物流信息。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, Query, Path, HTTPException, status as http_status
from fastapi.responses import JSONResponse, HTMLResponse
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError

from apps.kuaizhizao.services.delivery_notice_service import DeliveryNoticeService
from apps.kuaizhizao.schemas.delivery_notice import (
    DeliveryNoticeCreate,
    DeliveryNoticeUpdate,
    DeliveryNoticeResponse,
    DeliveryNoticeListResponse,
    DeliveryNoticeWithItemsResponse,
    DeliveryNoticePullCandidateListResponse,
    DeliveryNoticePullPreviewResponse,
)

delivery_notice_service = DeliveryNoticeService()
router = APIRouter(
    prefix="/delivery-notices",
    tags=["App - Kuaige Zhizao - Delivery Notice"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-notice", resolve_print=False))],
)


@router.get(
    "/pull-candidates",
    response_model=DeliveryNoticePullCandidateListResponse,
    summary="List sales delivery pull candidates for delivery notice",
)
async def list_delivery_notice_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    keyword: Optional[str] = Query(None, description="出库单号/订单号/客户"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await delivery_notice_service.list_delivery_notice_pull_candidates(
        tenant_id,
        keyword=keyword,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/sales-delivery-preview",
    response_model=DeliveryNoticePullPreviewResponse,
    summary="Preview delivery notice from sales delivery",
)
async def preview_delivery_notice_from_sales_delivery(
    sales_delivery_id: int = Query(..., description="销售出库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DeliveryNoticePullPreviewResponse:
    try:
        return await delivery_notice_service.get_delivery_notice_pull_preview(
            tenant_id=tenant_id,
            sales_delivery_id=sales_delivery_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/sales-delivery-pull-lines",
    summary="Open sales delivery lines for delivery notice pull",
    dependencies=[Depends(require_permission_codes("kuaizhizao:outbound:read"))],
)
async def list_delivery_notice_pull_lines(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None, description="物料编码/名称/规格"),
    sales_delivery_id: Optional[int] = Query(None, description="来源销售出库单"),
    pullable_only: bool = Query(True, description="仅剩余可通知量大于 0"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """开口销售出库行，供送货单跨单取明细。"""
    try:
        return await delivery_notice_service.list_delivery_notice_pull_lines(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            sales_delivery_id=sales_delivery_id,
            pullable_only=pullable_only,
        )
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/pull-from-sales-delivery-items",
    summary="Create delivery notices from sales delivery lines",
    dependencies=[Depends(require_permission_codes("kuaizhizao:delivery-notice:create"))],
)
async def pull_from_sales_delivery_items(
    request: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """从多张销售出库单的开口行创建送货单（同客户合并）。"""
    raw_ids = request.get("selected_item_ids")
    if not isinstance(raw_ids, list) or not raw_ids:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="请至少选择一条可通知销售出库明细")
    try:
        selected_ids = [int(v) for v in raw_ids]
    except (TypeError, ValueError):
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="明细ID格式无效")
    try:
        return await delivery_notice_service.create_delivery_notices_from_sales_delivery_items(
            tenant_id=tenant_id,
            item_ids=selected_ids,
            created_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        logger.exception("从销售出库开口行创建送货单失败")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="从销售出库开口行创建送货单失败",
        )


@router.post("", response_model=DeliveryNoticeResponse, summary="Create delivery notice")
async def create_delivery_notice(
    notice_data: DeliveryNoticeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建送货单，通知单编码自动生成"""
    try:
        return await delivery_notice_service.create_delivery_notice(
            tenant_id=tenant_id,
            notice_data=notice_data,
            created_by=current_user.id,
        )
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建送货单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建送货单失败",
        )


@router.get("", summary="List delivery notices")
async def list_delivery_notices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    sales_delivery_id: Optional[int] = Query(None),
    sales_order_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    sent_start_date: Optional[str] = Query(None, description="发送时间起"),
    sent_end_date: Optional[str] = Query(None, description="发送时间止"),
    planned_delivery_start_date: Optional[str] = Query(None, description="预计送达日期起"),
    planned_delivery_end_date: Optional[str] = Query(None, description="预计送达日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取送货单列表"""
    items, total = await delivery_notice_service.list_delivery_notices(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        sales_delivery_id=sales_delivery_id,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
        keyword=keyword,
        search=search,
        order_by=order_by,
        sent_start_date=sent_start_date,
        sent_end_date=sent_end_date,
        planned_delivery_start_date=planned_delivery_start_date,
        planned_delivery_end_date=planned_delivery_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{notice_id}", response_model=DeliveryNoticeWithItemsResponse, summary="Get delivery notice")
async def get_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取送货单详情（含明细）"""
    try:
        return await delivery_notice_service.get_delivery_notice_by_id(
            tenant_id=tenant_id,
            notice_id=notice_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{notice_id}", response_model=DeliveryNoticeResponse, summary="Update delivery notice")
async def update_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    notice_data: DeliveryNoticeUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新送货单，仅待发送状态可更新"""
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


@router.delete("/{notice_id}", summary="Delete delivery notice")
async def delete_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除送货单，仅待发送状态可删除"""
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


@router.post("/{notice_id}/send", response_model=DeliveryNoticeResponse, summary="Send notification")
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


@router.get(
    "/{notice_id}/print",
    summary="Print delivery notice",
    dependencies=[Depends(require_permission_codes("kuaizhizao:delivery-notice:print"))],
)
async def print_delivery_notice(
    notice_id: int = Path(..., description="通知单ID"),
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印送货单"""
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


@router.get(
    "/{notice_id}/resolve-quality-certificate",
    summary="Resolve quality certificates for delivery notice",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-finished-goods-inspection:print"))],
)
async def resolve_delivery_notice_quality_certificates(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        certificates = await DocumentPrintService.resolve_quality_certificates_for_delivery_notice(
            tenant_id, notice_id
        )
        return {"success": True, "certificates": certificates}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
