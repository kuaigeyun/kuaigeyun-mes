"""
售后服务工单 API
"""

from datetime import datetime
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_ticket import (
    AfterSalesTicketClose,
    AfterSalesTicketCreate,
    AfterSalesTicketListEnvelope,
    AfterSalesTicketPullFromSalesDeliveryRequest,
    AfterSalesTicketPullFromSalesOrderRequest,
    AfterSalesTicketPushPreviewResponse,
    AfterSalesTicketPushToSalesReturnRequest,
    AfterSalesTicketResponse,
    AfterSalesTicketUpdate,
)
from apps.kuaizhizao.services.after_sales_ticket_service import (
    AFTER_SALES_TICKET_SORTABLE_FIELDS,
    AfterSalesTicketService,
)
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales-tickets",
    tags=["App - Kuaige Zhizao - After-sales Ticket"],
    dependencies=[Depends(require_kuaizhizao_module_access("after-sales-ticket"))],
)

_service = AfterSalesTicketService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/after-sales-tickets",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_after_sales_tickets_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.post("", response_model=AfterSalesTicketResponse, summary="Create after-sales ticket")
async def create_ticket(
    body: AfterSalesTicketCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=AfterSalesTicketListEnvelope, summary="List after-sales tickets")
async def list_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    request_type: Optional[str] = Query(None, description="诉求类型"),
    status_filter: Optional[str] = Query(None, alias="status", description="工单状态"),
    keyword: Optional[str] = Query(None),
    sales_order_code: Optional[str] = Query(None, description="关联销售订单号（模糊）"),
    registered_from: Optional[datetime] = Query(None),
    registered_to: Optional[datetime] = Query(None),
    order_by: Optional[str] = Query(None, description="排序字段，如 registered_at、-status"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in AFTER_SALES_TICKET_SORTABLE_FIELDS:
            safe_order_by = order_by

    return await _service.list_tickets(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        request_type=request_type,
        status=status_filter,
        keyword=keyword,
        sales_order_code=sales_order_code,
        registered_from=registered_from,
        registered_to=registered_to,
        order_by=safe_order_by,
        current_user=current_user,
    )


@router.post(
    "/pull-from-sales-order",
    response_model=AfterSalesTicketResponse,
    summary="Pull create after-sales ticket from sales order",
)
async def pull_from_sales_order(
    body: AfterSalesTicketPullFromSalesOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.pull_from_sales_order(tenant_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/pull-from-sales-delivery",
    response_model=AfterSalesTicketResponse,
    summary="Pull create after-sales ticket from sales delivery",
)
async def pull_from_sales_delivery(
    body: AfterSalesTicketPullFromSalesDeliveryRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.pull_from_sales_delivery(tenant_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{ticket_id}", response_model=AfterSalesTicketResponse, summary="Get after-sales ticket")
async def get_ticket(
    ticket_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, ticket_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{ticket_id}", response_model=AfterSalesTicketResponse, summary="Update after-sales ticket")
async def update_ticket(
    body: AfterSalesTicketUpdate,
    ticket_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, ticket_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{ticket_id}/push-to-sales-return/preview",
    response_model=AfterSalesTicketPushPreviewResponse,
    summary="Preview push after-sales ticket to sales return",
)
async def preview_push_to_sales_return(
    ticket_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.preview_push_to_sales_return(tenant_id, ticket_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{ticket_id}/push-to-sales-return",
    summary="Push after-sales ticket to sales return",
)
async def push_to_sales_return(
    body: AfterSalesTicketPushToSalesReturnRequest,
    ticket_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.push_to_sales_return(tenant_id, ticket_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{ticket_id}/close", response_model=AfterSalesTicketResponse, summary="Close after-sales ticket")
async def close_ticket(
    body: AfterSalesTicketClose,
    ticket_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.close(tenant_id, ticket_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{ticket_id}", summary="Delete after-sales ticket")
async def delete_ticket(
    ticket_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, ticket_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
