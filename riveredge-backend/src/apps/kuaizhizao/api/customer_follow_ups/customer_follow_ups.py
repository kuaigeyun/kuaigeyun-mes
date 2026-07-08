"""
客户跟进记录 API
"""

from datetime import datetime
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.schemas.customer_follow_up import (
    CustomerFollowUpCreate,
    CustomerFollowUpUpdate,
    CustomerFollowUpResponse,
    CustomerFollowUpListEnvelope,
)
from apps.kuaizhizao.services.customer_follow_up_service import (
    CustomerFollowUpService,
    CUSTOMER_FOLLOW_UP_SORTABLE_FIELDS,
)
from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/customer-follow-ups",
    tags=["App · Kuaige Zhizao · Customer Follow-up"],
    dependencies=[Depends(require_kuaizhizao_module_access("customer-follow-up"))],
)

_service = CustomerFollowUpService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/customer-follow-ups",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_customer_follow_ups_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("", response_model=CustomerFollowUpResponse, summary="Create customer follow-up")
async def create_follow_up(
    body: CustomerFollowUpCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=CustomerFollowUpListEnvelope, summary="List customer follow-ups")
async def list_follow_ups(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    activity_type_code: Optional[str] = Query(None, description="跟进方式（字典 SALES_FOLLOW_UP_TYPE）"),
    keyword: Optional[str] = Query(None),
    quotation_code: Optional[str] = Query(None, description="关联报价单号（模糊）"),
    sales_order_code: Optional[str] = Query(None, description="关联销售订单号（模糊）"),
    occurred_from: Optional[datetime] = Query(None),
    occurred_to: Optional[datetime] = Query(None),
    pending_only: bool = Query(False, description="仅显示已到期待跟进（下次跟进时间已至）"),
    order_by: Optional[str] = Query(None, description="排序字段，如 occurred_at、-next_follow_up_at"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in CUSTOMER_FOLLOW_UP_SORTABLE_FIELDS:
            safe_order_by = order_by

    return await _service.list_follow_ups(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        activity_type_code=activity_type_code,
        keyword=keyword,
        quotation_code=quotation_code,
        sales_order_code=sales_order_code,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
        pending_only=pending_only,
        order_by=safe_order_by,
        current_user=current_user,
    )


@router.get("/{follow_id}", response_model=CustomerFollowUpResponse, summary="Get customer follow-up")
async def get_follow_up(
    follow_id: int = Path(..., description="跟进记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, follow_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{follow_id}", response_model=CustomerFollowUpResponse, summary="Update customer follow-up")
async def update_follow_up(
    body: CustomerFollowUpUpdate,
    follow_id: int = Path(..., description="跟进记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, follow_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{follow_id}", summary="Delete customer follow-up")
async def delete_follow_up(
    follow_id: int = Path(..., description="跟进记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, follow_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
