"""
发货通知单管理 API 路由模块

销售通知仓库发货，不直接动库存。

Author: RiverEdge Team
Date: 2026-02-22
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException as FastAPIHTTPException, status as http_status
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError

from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService
from apps.kuaizhizao.schemas.shipment_notice import (
    ShipmentNoticeCreate,
    ShipmentNoticeUpdate,
    ShipmentNoticeResponse,
    ShipmentNoticeListResponse,
    ShipmentNoticeWithItemsResponse,
)

shipment_notice_service = ShipmentNoticeService()
router = APIRouter(prefix="/shipment-notices", tags=["App · Kuaige Zhizao · Shipment Notice"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/shipment-notices",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_shipment_notices_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("", response_model=ShipmentNoticeResponse, summary="Create shipment notice")
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


@router.get("", response_model=List[ShipmentNoticeListResponse], summary="List shipment notices")
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


@router.get("/{notice_id}", response_model=ShipmentNoticeWithItemsResponse, summary="Get shipment notice")
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


@router.put("/{notice_id}", response_model=ShipmentNoticeResponse, summary="Update shipment notice")
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


@router.delete("/{notice_id}", summary="Delete shipment notice")
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


@router.post("/{notice_id}/notify", response_model=ShipmentNoticeResponse, summary="Notify warehouse")
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


@router.post("/{notice_id}/withdraw", response_model=ShipmentNoticeResponse, summary="Withdraw notice")
async def withdraw_shipment_notice(
    notice_id: int = Path(..., description="通知单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """撤回通知（已通知 -> 待发货）"""
    try:
        return await shipment_notice_service.withdraw_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
            withdrawn_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{notice_id}/print",
    summary="Print shipment notice",
    dependencies=[Depends(require_permission_codes("kuaizhizao:shipment-notice:print"))],
)
async def print_shipment_notice(
    notice_id: int = Path(..., description="发货通知单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="shipment_notice",
            document_id=notice_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))

    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)
