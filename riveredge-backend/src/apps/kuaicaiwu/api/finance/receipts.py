"""
收款单管理 API 路由
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from datetime import date, datetime
from loguru import logger

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaicaiwu.schemas.finance import (
    ReceiptVoucherCreate, ReceiptVoucherUpdate,
    ReceiptVoucherResponse, ReceiptVoucherListResponse,
)
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.finance_service import AccountSettlementService
from apps.kuaicaiwu.services.receipt_pull_service import ReceiptPullService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import BusinessLogicError
from core.utils.timezone_utils import today_site_str

router = APIRouter(prefix="/receipts", tags=["App - Kuaicaiwu - Finance"])
receipt_pull_service = ReceiptPullService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_receipts_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


async def _get_or_404(tenant_id: int, receipt_id: int, route: str = "/receipts/{id}") -> Receipt:
    obj = await Receipt.get_or_none(tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True)
    if not obj:
        raise _http_exception_with_trace(404, f"收款单不存在: {receipt_id}", route, tenant_id)
    return obj


async def _serialize(tenant_id: int, user_id: int, obj: Receipt) -> ReceiptVoucherResponse:
    payload = ReceiptVoucherResponse.model_validate(obj).model_dump()
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:receipt",
        payload=payload,
    )
    return ReceiptVoucherResponse.model_validate(masked)


@router.post("", response_model=ReceiptVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    data: ReceiptVoucherCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建收款单"""
    try:
        pull_preview: Optional[Dict[str, Any]] = None
        if data.source_type and data.source_id:
            pull_preview = await receipt_pull_service.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                total_amount=Decimal(data.total_amount),
            )

        today = today_site_str()
        count = await Receipt.filter(tenant_id=tenant_id).count()
        code = f"SK{today}{count + 1:04d}"
        customer_id = data.customer_id
        customer_name = data.customer_name
        if pull_preview:
            customer_id = int(pull_preview.get("customer_id") or customer_id)
            customer_name = str(pull_preview.get("customer_name") or customer_name or "")

        receipt_payload = {
            "tenant_id": tenant_id,
            "receipt_code": code,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "total_amount": data.total_amount,
            "settled_amount": 0,
            "unsettled_amount": data.total_amount,
            "receipt_date": data.receipt_date,
            "payment_method": data.payment_method,
            "bank_account": data.bank_account,
            "bank_account_id": data.bank_account_id,
            "settlement_type": data.settlement_type or "normal",
            "status": "Draft",
            "notes": data.notes,
            "attachments": data.attachments,
        }
        apply_create_audit(receipt_payload, current_user)
        receipt = await Receipt.create(**receipt_payload)
        if pull_preview and data.source_type and data.source_id:
            await receipt_pull_service.create_pull_relation(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                source_code=str(pull_preview.get("source_code") or ""),
                receipt_id=int(receipt.id),
                receipt_code=str(receipt.receipt_code),
                created_by=current_user.id,
            )
            if str(data.source_type or "").strip() == "receivable":
                await receipt_pull_service.settle_pull_created_receipt(
                    tenant_id=tenant_id,
                    receivable_id=int(data.source_id),
                    receipt_id=int(receipt.id),
                    amount=Decimal(data.total_amount),
                    operator_id=current_user.id,
                )
                if data.bank_account_id:
                    from apps.kuaicaiwu.services.bank_account_service import BankAccountService

                    await BankAccountService().sync_from_confirmed_voucher(
                        tenant_id,
                        voucher_type="receipt",
                        voucher_id=int(receipt.id),
                        operator_id=current_user.id,
                    )
        return await _serialize(tenant_id, current_user.id, receipt)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/receipts", tenant_id) from e


@router.get("", response_model=ReceiptVoucherListResponse)
async def list_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    unsettled_only: bool = Query(False, description="仅返回有余额的收款单（unsettled_amount > 0）"),
    settlement_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    keyword: Optional[str] = Query(None),
    receipt_code: Optional[str] = Query(None),
    customer_name: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取收款单列表"""
    from apps.kuaicaiwu.services.finance_list_core import apply_finance_voucher_list_filters

    try:
        settlement_service = AccountSettlementService()
        await settlement_service.backfill_receipts_from_legacy_receivables(tenant_id, current_user.id)
    except Exception as exc:
        logger.warning(
            "kuaicaiwu_receipts_backfill_failed tenant_id={} user_id={} error={}",
            tenant_id,
            current_user.id,
            exc,
        )

    query = Receipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if status:
        query = query.filter(status=status)
    if unsettled_only:
        query = query.filter(unsettled_amount__gt=0).exclude(status="Cancelled")
    if customer_id:
        query = query.filter(customer_id=customer_id)
    if settlement_type:
        query = query.filter(settlement_type=settlement_type)

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
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_field=sort_field,
        sort_order=sort_order,
        default_sort_col="receipt_date",
    )

    total = await query.count()
    items = await query.order_by(order_expr, "-id").offset(skip).limit(limit).all()
    serialized = [await _serialize(tenant_id, current_user.id, r) for r in items]
    return ReceiptVoucherListResponse(
        items=serialized,
        total=total, skip=skip, limit=limit
    )


@router.get(
    "/pull-candidates/receivables",
    summary="List receivable pull candidates for receipt",
)
async def list_receipt_receivable_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await receipt_pull_service.list_receivable_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-receivable/{receivable_id}/pull-preview",
    summary="Preview pull receipt from receivable",
)
async def preview_pull_receipt_from_receivable(
    receivable_id: int = Path(..., description="应收单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await receipt_pull_service.preview_pull_from_receivable(
        tenant_id=tenant_id,
        receivable_id=receivable_id,
    )


@router.get("/{id}", response_model=ReceiptVoucherResponse)
async def get_receipt(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取收款单详情"""
    receipt = await _get_or_404(tenant_id, id)
    return await _serialize(tenant_id, current_user.id, receipt)


@router.put("/{id}", response_model=ReceiptVoucherResponse)
async def update_receipt(
    id: int,
    data: ReceiptVoucherUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的收款单不能修改", "/receipts/{id}", tenant_id)
    update_data = data.model_dump(exclude_unset=True)
    apply_update_audit(update_data, current_user)
    await Receipt.filter(id=id).update(**update_data)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/confirm", response_model=ReceiptVoucherResponse)
async def confirm_receipt(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """确认收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status != "Draft":
        raise _http_exception_with_trace(400, "只有草稿状态的收款单可以确认", "/receipts/{id}/confirm", tenant_id)
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService
    from infra.exceptions.exceptions import ValidationError

    try:
        settled = await receipt_pull_service.settle_draft_receipt_if_linked(
            tenant_id=tenant_id,
            receipt_id=id,
            operator_id=current_user.id,
        )
    except ValidationError as exc:
        raise _http_exception_with_trace(400, str(exc), "/receipts/{id}/confirm", tenant_id) from exc

    if not settled:
        from apps.common.audit_actor import apply_update_audit

        confirm_payload: dict = {"status": "Confirmed"}
        apply_update_audit(confirm_payload, current_user)
        await Receipt.filter(id=id).update(**confirm_payload)

    receipt = await _get_or_404(tenant_id, id)
    if receipt.bank_account_id:
        try:
            await BankAccountService().sync_from_confirmed_voucher(
                tenant_id, voucher_type="receipt", voucher_id=id, operator_id=current_user.id
            )
        except ValidationError as exc:
            raise _http_exception_with_trace(400, str(exc), "/receipts/{id}/confirm", tenant_id) from exc
    return await _serialize(tenant_id, current_user.id, receipt)


@router.post("/{id}/cancel", response_model=ReceiptVoucherResponse)
async def cancel_receipt(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """作废收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.settled_amount > 0:
        raise _http_exception_with_trace(400, "已有核销记录的收款单不能作废", "/receipts/{id}/cancel", tenant_id)
    await Receipt.filter(id=id).update(status="Cancelled")
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:receipt:delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的收款单不能删除", "/receipts/{id}", tenant_id)
    await Receipt.filter(id=id).delete()
