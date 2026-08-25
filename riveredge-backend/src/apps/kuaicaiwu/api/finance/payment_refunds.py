"""
付款退款 API
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from loguru import logger

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.schemas.finance import (
    PaymentVoucherCreate,
    PaymentVoucherUpdate,
    PaymentVoucherResponse,
    PaymentVoucherListResponse,
)
from apps.kuaicaiwu.services.payment_refund_service import PaymentRefundService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import BusinessLogicError
from core.utils.timezone_utils import today_site_str

router = APIRouter(prefix="/payment-refunds", tags=["App - Kuaicaiwu - Finance"])
refund_service = PaymentRefundService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_payment_refunds_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


async def _get_or_404(tenant_id: int, payment_id: int, route: str = "/payment-refunds/{id}") -> Payment:
    obj = await Payment.get_or_none(
        tenant_id=tenant_id,
        id=payment_id,
        deleted_at__isnull=True,
        settlement_type="refund",
    )
    if not obj:
        raise _http_exception_with_trace(404, f"付款退款单不存在: {payment_id}", route, tenant_id)
    return obj


async def _serialize(tenant_id: int, user_id: int, obj: Payment) -> PaymentVoucherResponse:
    payload = PaymentVoucherResponse.model_validate(obj).model_dump()
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:payment-refund",
        payload=payload,
    )
    return PaymentVoucherResponse.model_validate(masked)


async def _serialize_detail(tenant_id: int, user_id: int, obj: Payment) -> PaymentVoucherResponse:
    from apps.kuaicaiwu.services.finance_voucher_enrichment import enrich_voucher_detail

    base = await _serialize(tenant_id, user_id, obj)
    enriched = await enrich_voucher_detail(tenant_id, base.model_dump(), kind="payment")
    return PaymentVoucherResponse.model_validate(enriched)


@router.post("", response_model=PaymentVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_refund(
    data: PaymentVoucherCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService
    from infra.exceptions.exceptions import ValidationError as FinanceValidationError

    if data.source_type != "payment" or not data.source_id:
        raise _http_exception_with_trace(400, "付款退款须指定源付款单", "/payment-refunds", tenant_id)

    try:
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=data.payment_method,
            bank_account_id=data.bank_account_id,
        )
    except FinanceValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/payment-refunds", tenant_id) from exc

    try:
        pull_preview = await refund_service.assert_pull_create_allowed(
            tenant_id=tenant_id,
            source_type="payment",
            source_id=int(data.source_id),
            total_amount=Decimal(data.total_amount),
        )
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/payment-refunds", tenant_id) from e

    today = today_site_str()
    count = await Payment.filter(tenant_id=tenant_id, settlement_type="refund").count()
    code = f"TP{today}{count + 1:04d}"

    payment_payload = {
        "tenant_id": tenant_id,
        "payment_code": code,
        "supplier_id": int(pull_preview.get("supplier_id") or data.supplier_id),
        "supplier_name": str(pull_preview.get("supplier_name") or data.supplier_name or ""),
        "total_amount": data.total_amount,
        "settled_amount": 0,
        "unsettled_amount": data.total_amount,
        "payment_date": data.payment_date,
        "payment_method": data.payment_method,
        "bank_account": data.bank_account,
        "bank_account_id": data.bank_account_id,
        "settlement_type": "refund",
        "status": "Draft",
        "notes": data.notes,
        "attachments": data.attachments,
    }
    apply_create_audit(payment_payload, current_user)
    payment = await Payment.create(**payment_payload)
    await refund_service.create_pull_relation(
        tenant_id=tenant_id,
        source_payment_id=int(data.source_id),
        source_code=str(pull_preview.get("source_code") or ""),
        refund_payment_id=int(payment.id),
        refund_payment_code=str(payment.payment_code),
        created_by=current_user.id,
    )
    return await _serialize(tenant_id, current_user.id, payment)


@router.get("", response_model=PaymentVoucherListResponse)
async def list_payment_refunds(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    keyword: Optional[str] = Query(None),
    payment_code: Optional[str] = Query(None),
    supplier_name: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    from apps.kuaicaiwu.services.finance_list_core import apply_finance_voucher_list_filters

    query = Payment.filter(
        tenant_id=tenant_id, deleted_at__isnull=True, settlement_type="refund"
    )
    if status:
        query = query.filter(status=status)
    if supplier_id:
        query = query.filter(supplier_id=supplier_id)

    doc_date_start = start_date.isoformat() if start_date else None
    doc_date_end = end_date.isoformat() if end_date else None

    query, order_expr = apply_finance_voucher_list_filters(
        query,
        doc_code_field="payment_code",
        partner_name_field="supplier_name",
        doc_date_field="payment_date",
        keyword=keyword,
        doc_code=payment_code,
        partner_name=supplier_name,
        doc_date_start=doc_date_start,
        doc_date_end=doc_date_end,
        sort_field=sort_field,
        sort_order=sort_order,
        default_sort_col="payment_date",
    )

    total = await query.count()
    items = await query.order_by(order_expr, "-id").offset(skip).limit(limit).all()
    serialized = [await _serialize(tenant_id, current_user.id, p) for p in items]
    return PaymentVoucherListResponse(items=serialized, total=total, skip=skip, limit=limit)


@router.get("/pull-candidates/payments")
async def list_payment_refund_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await refund_service.list_payment_pull_candidates(
        tenant_id=tenant_id, skip=skip, limit=limit, keyword=keyword
    )


@router.get("/from-payment/{payment_id}/pull-preview")
async def preview_pull_payment_refund(
    payment_id: int = Path(..., description="源付款单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await refund_service.preview_pull_from_payment(tenant_id, payment_id)


@router.get("/{id}", response_model=PaymentVoucherResponse)
async def get_payment_refund(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    return await _serialize_detail(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.put("/{id}", response_model=PaymentVoucherResponse)
async def update_payment_refund(
    id: int,
    data: PaymentVoucherUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    payment = await _get_or_404(tenant_id, id)
    if payment.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的付款退款不能修改", "/payment-refunds/{id}", tenant_id)
    update_data = data.model_dump(exclude_unset=True)
    update_data.pop("settlement_type", None)
    apply_update_audit(update_data, current_user)
    await Payment.filter(id=id).update(**update_data)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/confirm", response_model=PaymentVoucherResponse)
async def confirm_payment_refund(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService
    from infra.exceptions.exceptions import ValidationError

    payment = await _get_or_404(tenant_id, id)
    try:
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=payment.payment_method,
            bank_account_id=payment.bank_account_id,
        )
    except ValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/payment-refunds/{id}/confirm", tenant_id) from exc

    try:
        await refund_service.confirm_refund(
            tenant_id, id, current_user.id, current_user=current_user
        )
    except ValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/payment-refunds/{id}/confirm", tenant_id) from exc

    payment = await _get_or_404(tenant_id, id)
    if payment.bank_account_id:
        try:
            await BankAccountService().sync_from_confirmed_voucher(
                tenant_id, voucher_type="payment", voucher_id=id, operator_id=current_user.id
            )
        except ValidationError as exc:
            raise _http_exception_with_trace(
                400, str(exc), "/payment-refunds/{id}/confirm", tenant_id
            ) from exc
    return await _serialize(tenant_id, current_user.id, payment)


@router.post("/{id}/cancel", response_model=PaymentVoucherResponse)
async def cancel_payment_refund(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment-refund:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    payment = await _get_or_404(tenant_id, id)
    if payment.status == "Confirmed":
        raise _http_exception_with_trace(
            400, "已确认的付款退款请通过冲销流程处理", "/payment-refunds/{id}/cancel", tenant_id
        )
    await Payment.filter(id=id).update(status="Cancelled")
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))
