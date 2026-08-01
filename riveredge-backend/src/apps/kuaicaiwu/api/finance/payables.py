"""
应付管理 API 路由
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    PayableCreate, PayableUpdate, PayableResponse, PayableListResponse,
    PaymentRecordCreate
)
from apps.kuaicaiwu.services.finance_service import PayableService
from apps.kuaicaiwu.services.payable_pull_service import PayablePullService
from apps.kuaicaiwu.utils.settlement_db_guard import (
    SETTLEMENTS_TABLE_MISSING_HINT,
    is_settlements_table_missing,
)
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/payables", tags=["App - Kuaicaiwu - Finance"])

payable_service = PayableService()
payable_pull_service = PayablePullService()

_PULL_SOURCE_TYPES = frozenset({"purchase_order", "purchase_receipt"})


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_payables_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("", response_model=PayableResponse, status_code=status.HTTP_201_CREATED)
async def create_payable(
    data: PayableCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        pull_preview: Optional[Dict[str, Any]] = None
        pull_source_type = str(data.pull_source_type or "").strip()
        pull_source_id = data.pull_source_id
        if pull_source_type and pull_source_id:
            if pull_source_type not in _PULL_SOURCE_TYPES:
                raise BusinessLogicError(f"不支持的加载源单类型: {pull_source_type}")
            pull_preview = await payable_pull_service.assert_pull_create_allowed(
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
            create_payload["supplier_id"] = int(pull_preview.get("supplier_id") or create_payload.get("supplier_id"))
            create_payload["supplier_name"] = str(
                pull_preview.get("supplier_name") or create_payload.get("supplier_name") or ""
            )
            create_payload["source_type"] = pull_source_type
            create_payload["source_id"] = int(pull_source_id)
            create_payload["source_code"] = str(pull_preview.get("source_code") or create_payload.get("source_code") or "")

        payable_data = PayableCreate.model_validate(create_payload)
        payable = await payable_service.create_payable(tenant_id, payable_data, current_user.id)

        if pull_preview and pull_source_type and pull_source_id:
            await payable_pull_service.create_pull_relation(
                tenant_id=tenant_id,
                source_type=pull_source_type,
                source_id=int(pull_source_id),
                source_code=str(pull_preview.get("source_code") or payable.source_code or ""),
                payable_id=int(payable.id),
                payable_code=str(payable.payable_code),
                created_by=current_user.id,
            )
        return PayableResponse.model_validate(payable)
    except ValidationError as e:
        raise _http_exception_with_trace(422, str(e), "/payables", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/payables", tenant_id) from e


@router.get("", response_model=PayableListResponse)
async def list_payables(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    pending_settlement: bool = Query(False, description="仅返回待核销应付（remaining_amount > 0）"),
    keyword: Optional[str] = Query(None),
    payable_code: Optional[str] = Query(None),
    supplier_name: Optional[str] = Query(None),
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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    payables, total = await payable_service.list_payables(
        tenant_id,
        skip,
        limit,
        status=status,
        supplier_id=supplier_id,
        pending_settlement=pending_settlement,
        keyword=keyword,
        payable_code=payable_code,
        supplier_name=supplier_name,
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
    enriched = await payable_pull_service.enrich_push_payment_capabilities(tenant_id, payables)
    items = [PayableResponse.model_validate(row) for row in enriched]
    return PayableListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/statistics")
async def get_payable_statistics(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await payable_service.get_payable_statistics(tenant_id)


@router.get("/aging")
async def get_payable_aging(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await payable_service.get_payable_aging_analysis(tenant_id)


@router.get(
    "/pull-candidates/purchase-orders",
    summary="List purchase order pull candidates for payable",
)
async def list_payable_purchase_order_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await payable_pull_service.list_purchase_order_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/pull-candidates/purchase-receipts",
    summary="List purchase receipt pull candidates for payable",
)
async def list_payable_purchase_receipt_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await payable_pull_service.list_purchase_receipt_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-purchase-order/{order_id}/pull-preview",
    summary="Preview pull payable from purchase order",
)
async def preview_pull_payable_from_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await payable_pull_service.preview_pull_from_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get(
    "/from-purchase-receipt/{receipt_id}/pull-preview",
    summary="Preview pull payable from purchase receipt",
)
async def preview_pull_payable_from_purchase_receipt(
    receipt_id: int = Path(..., description="采购入库单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await payable_pull_service.preview_pull_from_purchase_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
    )


@router.get("/{id}", response_model=PayableResponse)
async def get_payable(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.get_payable_by_id(tenant_id, id)
        return payable
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/payables/{id}", tenant_id)


@router.post("/{id}/payment", response_model=PayableResponse)
async def record_payment(
    id: int,
    data: PaymentRecordCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.record_payment(tenant_id, id, data, current_user.id)
        return payable
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/payables/{id}/payment", tenant_id) from e
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(400, str(e), "/payables/{id}/payment", tenant_id) from e
    except Exception as e:
        if is_settlements_table_missing(e):
            logger.exception(
                "record_payment missing settlements table tenant_id={} payable_id={}",
                tenant_id,
                id,
            )
            raise _http_exception_with_trace(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                SETTLEMENTS_TABLE_MISSING_HINT,
                "/payables/{id}/payment",
                tenant_id,
            ) from e
        raise


@router.post("/{id}/approve", response_model=PayableResponse)
async def approve_payable(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.approve_payable(tenant_id, id, current_user.id, rejection_reason)
        return payable
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/payables/{id}/approve", tenant_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payable(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payable:delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await payable_service.delete_payable(tenant_id, id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/payables/{id}", tenant_id)
