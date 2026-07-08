"""
应收管理 API 路由
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    ReceivableCreate, ReceivableUpdate, ReceivableResponse, ReceivableListResponse,
    ReceiptRecordCreate
)
from apps.kuaicaiwu.services.finance_service import ReceivableService
from apps.kuaicaiwu.services.receivable_pull_service import ReceivablePullService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/receivables", tags=["App · Kuaicaiwu · Finance"])

receivable_service = ReceivableService()
receivable_pull_service = ReceivablePullService()

_PULL_SOURCE_TYPES = frozenset({"sales_order", "sales_delivery"})


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_receivables_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.post("", response_model=ReceivableResponse, status_code=status.HTTP_201_CREATED)
async def create_receivable(
    data: ReceivableCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        pull_preview: Optional[Dict[str, Any]] = None
        pull_source_type = str(data.pull_source_type or "").strip()
        pull_source_id = data.pull_source_id
        if pull_source_type and pull_source_id:
            if pull_source_type not in _PULL_SOURCE_TYPES:
                raise BusinessLogicError(f"不支持的上拉源单类型: {pull_source_type}")
            pull_preview = await receivable_pull_service.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type=pull_source_type,
                source_id=int(pull_source_id),
                total_amount=Decimal(data.total_amount),
            )

        create_payload = data.model_dump(
            exclude_unset=True,
            exclude={"pull_source_type", "pull_source_id"},
        )
        if pull_preview:
            create_payload["customer_id"] = int(pull_preview.get("customer_id") or create_payload.get("customer_id"))
            create_payload["customer_name"] = str(
                pull_preview.get("customer_name") or create_payload.get("customer_name") or ""
            )
            create_payload["source_type"] = pull_source_type
            create_payload["source_id"] = int(pull_source_id)
            create_payload["source_code"] = str(pull_preview.get("source_code") or create_payload.get("source_code") or "")

        receivable_data = ReceivableCreate.model_validate(create_payload)
        receivable = await receivable_service.create_receivable(tenant_id, receivable_data, current_user.id)

        if pull_preview and pull_source_type and pull_source_id:
            await receivable_pull_service.create_pull_relation(
                tenant_id=tenant_id,
                source_type=pull_source_type,
                source_id=int(pull_source_id),
                source_code=str(pull_preview.get("source_code") or receivable.source_code or ""),
                receivable_id=int(receivable.id),
                receivable_code=str(receivable.receivable_code),
                created_by=current_user.id,
            )
        return ReceivableResponse.model_validate(receivable)
    except ValidationError as e:
        raise _http_exception_with_trace(422, str(e), "/receivables", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/receivables", tenant_id) from e


@router.get("", response_model=ReceivableListResponse)
async def list_receivables(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    pending_settlement: bool = Query(False, description="仅返回待核销应收（remaining_amount > 0）"),
    keyword: Optional[str] = Query(None),
    receivable_code: Optional[str] = Query(None),
    customer_name: Optional[str] = Query(None),
    review_status: Optional[str] = None,
    business_date_start: Optional[str] = Query(None),
    business_date_end: Optional[str] = Query(None),
    due_date_start: Optional[str] = Query(None),
    due_date_end: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    receivables, total = await receivable_service.list_receivables(
        tenant_id,
        skip,
        limit,
        status=status,
        customer_id=customer_id,
        pending_settlement=pending_settlement,
        keyword=keyword,
        receivable_code=receivable_code,
        customer_name=customer_name,
        review_status=review_status,
        business_date_start=business_date_start,
        business_date_end=business_date_end,
        due_date_start=due_date_start,
        due_date_end=due_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_field=sort_field,
        sort_order=sort_order,
    )
    enriched = await receivable_pull_service.enrich_push_receipt_capabilities(tenant_id, receivables)
    items = [ReceivableResponse.model_validate(row) for row in enriched]
    return ReceivableListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/statistics")
async def get_receivable_statistics(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await receivable_service.get_receivable_statistics(tenant_id)


@router.get("/aging")
async def get_receivable_aging(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await receivable_service.get_receivable_aging_analysis(tenant_id)


@router.get(
    "/pull-candidates/sales-orders",
    summary="List sales order pull candidates for receivable",
)
async def list_receivable_sales_order_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await receivable_pull_service.list_sales_order_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/pull-candidates/sales-deliveries",
    summary="List sales delivery pull candidates for receivable",
)
async def list_receivable_sales_delivery_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await receivable_pull_service.list_sales_delivery_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-sales-order/{order_id}/pull-preview",
    summary="Preview pull receivable from sales order",
)
async def preview_pull_receivable_from_sales_order(
    order_id: int = Path(..., description="销售订单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await receivable_pull_service.preview_pull_from_sales_order(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get(
    "/from-sales-delivery/{delivery_id}/pull-preview",
    summary="Preview pull receivable from sales delivery",
)
async def preview_pull_receivable_from_sales_delivery(
    delivery_id: int = Path(..., description="销售出库单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await receivable_pull_service.preview_pull_from_sales_delivery(
        tenant_id=tenant_id,
        delivery_id=delivery_id,
    )


@router.get("/{id}", response_model=ReceivableResponse)
async def get_receivable(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.get_receivable_by_id(tenant_id, id)
        return receivable
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/receivables/{id}", tenant_id)


@router.post("/{id}/receipt", response_model=ReceivableResponse)
async def record_receipt(
    id: int,
    data: ReceiptRecordCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        receivable = await receivable_service.record_receipt(tenant_id, id, data, current_user.id)
        return receivable
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/receivables/{id}/receipt", tenant_id)


@router.post("/{id}/approve", response_model=ReceivableResponse)
async def approve_receivable(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        receivable = await receivable_service.approve_receivable(tenant_id, id, current_user.id, rejection_reason)
        return receivable
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/receivables/{id}/approve", tenant_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receivable(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receivable:delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await receivable_service.delete_receivable(tenant_id, id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/receivables/{id}", tenant_id)
