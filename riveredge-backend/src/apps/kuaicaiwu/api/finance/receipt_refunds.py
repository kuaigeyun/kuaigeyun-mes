"""
收款退款 API
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from loguru import logger

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.schemas.finance import (
    ReceiptVoucherCreate,
    ReceiptVoucherUpdate,
    ReceiptVoucherResponse,
    ReceiptVoucherListResponse,
)
from apps.kuaicaiwu.services.receipt_refund_service import ReceiptRefundService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import BusinessLogicError
from core.utils.timezone_utils import today_site_str

router = APIRouter(prefix="/receipt-refunds", tags=["App - Kuaicaiwu - Finance"])
refund_service = ReceiptRefundService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_receipt_refunds_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


async def _get_or_404(tenant_id: int, receipt_id: int, route: str = "/receipt-refunds/{id}") -> Receipt:
    obj = await Receipt.get_or_none(
        tenant_id=tenant_id,
        id=receipt_id,
        deleted_at__isnull=True,
        settlement_type="refund",
    )
    if not obj:
        raise _http_exception_with_trace(404, f"收款退款单不存在: {receipt_id}", route, tenant_id)
    return obj


async def _serialize(tenant_id: int, user_id: int, obj: Receipt) -> ReceiptVoucherResponse:
    payload = ReceiptVoucherResponse.model_validate(obj).model_dump()
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:receipt-refund",
        payload=payload,
    )
    return ReceiptVoucherResponse.model_validate(masked)


async def _serialize_detail(tenant_id: int, user_id: int, obj: Receipt) -> ReceiptVoucherResponse:
    from apps.kuaicaiwu.services.finance_voucher_enrichment import enrich_voucher_detail

    base = await _serialize(tenant_id, user_id, obj)
    enriched = await enrich_voucher_detail(tenant_id, base.model_dump(), kind="receipt")
    return ReceiptVoucherResponse.model_validate(enriched)


@router.post("", response_model=ReceiptVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt_refund(
    data: ReceiptVoucherCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService
    from infra.exceptions.exceptions import ValidationError as FinanceValidationError

    if data.source_type != "receipt" or not data.source_id:
        raise _http_exception_with_trace(400, "收款退款须指定源收款单", "/receipt-refunds", tenant_id)

    try:
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=data.payment_method,
            bank_account_id=data.bank_account_id,
        )
    except FinanceValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/receipt-refunds", tenant_id) from exc

    try:
        pull_preview = await refund_service.assert_pull_create_allowed(
            tenant_id=tenant_id,
            source_type="receipt",
            source_id=int(data.source_id),
            total_amount=Decimal(data.total_amount),
        )
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/receipt-refunds", tenant_id) from e

    today = today_site_str()
    count = await Receipt.filter(tenant_id=tenant_id, settlement_type="refund").count()
    code = f"TK{today}{count + 1:04d}"

    receipt_payload = {
        "tenant_id": tenant_id,
        "receipt_code": code,
        "customer_id": int(pull_preview.get("customer_id") or data.customer_id),
        "customer_name": str(pull_preview.get("customer_name") or data.customer_name or ""),
        "total_amount": data.total_amount,
        "settled_amount": 0,
        "unsettled_amount": data.total_amount,
        "receipt_date": data.receipt_date,
        "payment_method": data.payment_method,
        "bank_account": data.bank_account,
        "bank_account_id": data.bank_account_id,
        "settlement_type": "refund",
        "status": "Draft",
        "notes": data.notes,
        "attachments": data.attachments,
    }
    apply_create_audit(receipt_payload, current_user)
    receipt = await Receipt.create(**receipt_payload)
    await refund_service.create_pull_relation(
        tenant_id=tenant_id,
        source_receipt_id=int(data.source_id),
        source_code=str(pull_preview.get("source_code") or ""),
        refund_receipt_id=int(receipt.id),
        refund_receipt_code=str(receipt.receipt_code),
        created_by=current_user.id,
    )
    return await _serialize(tenant_id, current_user.id, receipt)


@router.get("", response_model=ReceiptVoucherListResponse)
async def list_receipt_refunds(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    keyword: Optional[str] = Query(None),
    receipt_code: Optional[str] = Query(None),
    customer_name: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    from apps.kuaicaiwu.services.finance_list_core import apply_finance_voucher_list_filters

    query = Receipt.filter(
        tenant_id=tenant_id, deleted_at__isnull=True, settlement_type="refund"
    )
    if status:
        query = query.filter(status=status)
    if customer_id:
        query = query.filter(customer_id=customer_id)

    doc_date_start = start_date.isoformat() if start_date else None
    doc_date_end = end_date.isoformat() if end_date else None

    query, order_expr = apply_finance_voucher_list_filters(
        query,
        doc_code_field="receipt_code",
        partner_name_field="customer_name",
        doc_date_field="receipt_date",
        keyword=keyword,
        doc_code=receipt_code,
        partner_name=customer_name,
        doc_date_start=doc_date_start,
        doc_date_end=doc_date_end,
        sort_field=sort_field,
        sort_order=sort_order,
        default_sort_col="receipt_date",
    )

    total = await query.count()
    items = await query.order_by(order_expr, "-id").offset(skip).limit(limit).all()
    serialized = [await _serialize(tenant_id, current_user.id, r) for r in items]
    return ReceiptVoucherListResponse(items=serialized, total=total, skip=skip, limit=limit)


@router.get("/pull-candidates/receipts")
async def list_receipt_refund_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await refund_service.list_receipt_pull_candidates(
        tenant_id=tenant_id, skip=skip, limit=limit, keyword=keyword
    )


@router.get("/from-receipt/{receipt_id}/pull-preview")
async def preview_pull_receipt_refund(
    receipt_id: int = Path(..., description="源收款单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await refund_service.preview_pull_from_receipt(tenant_id, receipt_id)


@router.get("/{id}", response_model=ReceiptVoucherResponse)
async def get_receipt_refund(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    return await _serialize_detail(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.put("/{id}", response_model=ReceiptVoucherResponse)
async def update_receipt_refund(
    id: int,
    data: ReceiptVoucherUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的收款退款不能修改", "/receipt-refunds/{id}", tenant_id)
    update_data = data.model_dump(exclude_unset=True)
    update_data.pop("settlement_type", None)
    apply_update_audit(update_data, current_user)
    await Receipt.filter(id=id).update(**update_data)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/confirm", response_model=ReceiptVoucherResponse)
async def confirm_receipt_refund(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService
    from infra.exceptions.exceptions import ValidationError

    receipt = await _get_or_404(tenant_id, id)
    try:
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=receipt.payment_method,
            bank_account_id=receipt.bank_account_id,
        )
    except ValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/receipt-refunds/{id}/confirm", tenant_id) from exc

    try:
        await refund_service.confirm_refund(
            tenant_id, id, current_user.id, current_user=current_user
        )
    except ValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/receipt-refunds/{id}/confirm", tenant_id) from exc

    receipt = await _get_or_404(tenant_id, id)
    if receipt.bank_account_id:
        try:
            await BankAccountService().sync_from_confirmed_voucher(
                tenant_id, voucher_type="receipt", voucher_id=id, operator_id=current_user.id
            )
        except ValidationError as exc:
            raise _http_exception_with_trace(
                400, str(exc), "/receipt-refunds/{id}/confirm", tenant_id
            ) from exc
    return await _serialize(tenant_id, current_user.id, receipt)


@router.post("/{id}/cancel", response_model=ReceiptVoucherResponse)
async def cancel_receipt_refund(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt-refund:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise _http_exception_with_trace(
            400, "已确认的收款退款请通过冲销流程处理", "/receipt-refunds/{id}/cancel", tenant_id
        )
    await Receipt.filter(id=id).update(status="Cancelled")
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))
