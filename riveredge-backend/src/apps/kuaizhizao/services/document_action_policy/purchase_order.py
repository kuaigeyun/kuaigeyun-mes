"""采购订单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import (
    DocumentStatus,
    LEGACY_AUDITED_VALUES,
    ORDER_PUSHABLE_STATUSES,
    ReviewStatus,
    is_draft_status,
    is_pending_review_status,
    normalize_status,
)
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PurchaseOrderCapabilities,
)
from apps.kuaizhizao.services.order_change.helpers import is_source_order_locked_for_direct_edit


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _normalize_review_status(review_status: Any) -> str:
    from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES

    raw = _norm(review_status)
    if not raw:
        return ""
    return REVIEW_STATUS_ALIASES.get(raw, raw.upper())


def _is_audited_status(status: Any) -> bool:
    raw = _norm(status)
    normalized = normalize_status(raw)
    return normalized in (DocumentStatus.AUDITED.value, DocumentStatus.CONFIRMED.value) or raw in LEGACY_AUDITED_VALUES


def _is_order_pushable_status(status: Any) -> bool:
    """与 ORDER_PUSHABLE_STATUSES 一致：已审核/已确认/执行中均可继续下推收货。"""
    raw = _norm(status)
    if not raw:
        return False
    normalized = normalize_status(raw)
    if normalized in (
        DocumentStatus.AUDITED.value,
        DocumentStatus.CONFIRMED.value,
        DocumentStatus.IN_PROGRESS.value,
    ):
        return True
    return raw in ORDER_PUSHABLE_STATUSES or normalized in ORDER_PUSHABLE_STATUSES


def _is_rejected_status(status: Any) -> bool:
    raw = _norm(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.REJECTED.value or raw in ("已驳回", "rejected", "REJECTED")


def _has_valid_supplier(order: Any) -> bool:
    return int(getattr(order, "supplier_id", 0) or 0) > 0


def _require_supplier_for_push(cap: ActionCapability, order: Any) -> ActionCapability:
    if cap.allowed and not _has_valid_supplier(order):
        return _cap(False, "purchase_order.push.no_supplier")
    return cap


def _derive_outstanding_push_cap(status: Any, *, has_items: bool, has_outstanding: bool) -> ActionCapability:
    push_allowed = False
    push_reason = "purchase_order.push_receipt.not_audited"
    if _is_order_pushable_status(status):
        if not has_items:
            push_reason = "purchase_order.push_receipt.no_items"
        elif not has_outstanding:
            push_reason = "purchase_order.push_receipt.no_outstanding"
        else:
            push_allowed = True
            push_reason = None
    return _cap(push_allowed, push_reason)


def _derive_receipt_notice_push_cap(
    status: Any,
    *,
    has_items: bool,
    has_pushable_notice_outstanding: bool,
    has_raw_outstanding: bool = False,
) -> ActionCapability:
    """按行剩余可通知数量开门禁；已有通知单不阻断分批下推。"""
    push_allowed = False
    push_reason = "purchase_order.push_receipt.not_audited"
    if _is_order_pushable_status(status):
        if not has_items:
            push_reason = "purchase_order.push_receipt.no_items"
        elif not has_pushable_notice_outstanding:
            push_reason = (
                "purchase_order.push_receipt_notice.qty_occupied"
                if has_raw_outstanding
                else "purchase_order.push_receipt.no_outstanding"
            )
        else:
            push_allowed = True
            push_reason = None
    return _cap(push_allowed, push_reason)


def _derive_purchase_receipt_push_cap(
    status: Any,
    *,
    has_items: bool,
    has_pushable_outstanding: bool,
    has_raw_outstanding: bool,
) -> ActionCapability:
    push_allowed = False
    push_reason = "purchase_order.push_receipt.not_audited"
    if _is_order_pushable_status(status):
        if not has_items:
            push_reason = "purchase_order.push_receipt.no_items"
        elif not has_pushable_outstanding:
            push_reason = (
                "purchase_order.push_receipt.qty_occupied"
                if has_raw_outstanding
                else "purchase_order.push_receipt.no_outstanding"
            )
        else:
            push_allowed = True
            push_reason = None
    return _cap(push_allowed, push_reason)


def derive_purchase_order_capabilities(
    order: Any,
    *,
    has_items: bool = True,
    has_outstanding: bool = False,
    has_pushable_receipt_outstanding: bool = False,
    has_pushable_notice_outstanding: bool = False,
    has_received: bool = False,
    has_invoice: bool = False,
    has_receipt_notice: bool = False,
    has_downstream: bool = False,
    has_pending_change: bool = False,
    has_returnable: bool = False,
    has_prepayment_payment: bool = False,
    require_payment_application: bool = False,
    prepayment_application_remaining: Optional[Decimal] = None,
) -> PurchaseOrderCapabilities:
    del has_receipt_notice  # 历史参数：通知单是否存在不再阻断分批下推
    status = getattr(order, "status", None)
    review_status = getattr(order, "review_status", None)

    update_allowed = is_draft_status(status or "") or is_pending_review_status(status or "")
    update_cap = _cap(
        update_allowed,
        "purchase_order.update.not_allowed" if not update_allowed else None,
    )

    delete_status_ok = is_draft_status(status or "") or is_pending_review_status(status or "")
    delete_allowed = delete_status_ok and not has_downstream
    delete_reason = None
    if has_downstream:
        delete_reason = "purchase_order.delete.has_downstream"
    elif not delete_status_ok:
        delete_reason = "purchase_order.delete.not_allowed"
    delete_cap = _cap(delete_allowed, delete_reason)

    submit_cap = _cap(
        is_draft_status(status or ""),
        "purchase_order.submit.not_draft" if not is_draft_status(status or "") else None,
    )

    withdraw_cap = _cap(
        is_pending_review_status(status or ""),
        "purchase_order.withdraw_submit.not_pending"
        if not is_pending_review_status(status or "")
        else None,
    )

    approve_cap = _cap(
        is_pending_review_status(status or "")
        or _normalize_review_status(review_status) == ReviewStatus.PENDING.value,
        "purchase_order.approve.not_pending"
        if not (
            is_pending_review_status(status or "")
            or _normalize_review_status(review_status) == ReviewStatus.PENDING.value
        )
        else None,
    )

    push_receipt_notice_cap = _require_supplier_for_push(
        _derive_receipt_notice_push_cap(
            status,
            has_items=has_items,
            has_pushable_notice_outstanding=has_pushable_notice_outstanding,
            has_raw_outstanding=has_outstanding,
        ),
        order,
    )
    push_receipt_cap = _require_supplier_for_push(
        _derive_purchase_receipt_push_cap(
            status,
            has_items=has_items,
            has_pushable_outstanding=has_pushable_receipt_outstanding,
            has_raw_outstanding=has_outstanding,
        ),
        order,
    )

    invoice_allowed = False
    invoice_reason = "purchase_order.push_invoice.not_audited"
    if _is_audited_status(status):
        if not has_items:
            invoice_reason = "purchase_order.push_invoice.no_items"
        elif has_invoice:
            invoice_reason = "purchase_order.push_invoice.already_fully_invoiced"
        else:
            invoice_allowed = True
            invoice_reason = None
    push_invoice_cap = _require_supplier_for_push(_cap(invoice_allowed, invoice_reason), order)

    prepay_allowed = False
    prepay_reason = "purchase_order.push_prepayment.not_audited"
    prepay_amount = Decimal(str(getattr(order, "prepayment_amount", 0) or 0))
    if _is_audited_status(status):
        if prepay_amount <= 0:
            prepay_reason = "purchase_order.push_prepayment.no_amount"
        elif require_payment_application:
            prepay_reason = "purchase_order.push_prepayment.require_application"
        elif has_prepayment_payment:
            prepay_reason = "purchase_order.push_prepayment.already_exists"
        else:
            prepay_allowed = True
            prepay_reason = None
    push_prepayment_cap = _require_supplier_for_push(_cap(prepay_allowed, prepay_reason), order)

    if prepayment_application_remaining is not None:
        prepay_app_remaining = prepayment_application_remaining
    else:
        prepay_app_remaining = prepay_amount
    push_app_allowed = False
    push_app_reason = "purchase_order.push_payment_application.not_audited"
    if _is_audited_status(status):
        if prepay_amount <= 0 or prepay_app_remaining <= 0:
            push_app_reason = "purchase_order.push_payment_application.no_amount"
        else:
            push_app_allowed = True
            push_app_reason = None
    push_payment_application_cap = _require_supplier_for_push(
        _cap(push_app_allowed, push_app_reason), order
    )

    return_allowed = False
    return_reason = "purchase_order.push_purchase_return.not_audited"
    if _is_audited_status(status):
        if not has_received:
            return_reason = "purchase_order.push_purchase_return.no_received"
        elif not has_returnable:
            return_reason = "purchase_order.push_purchase_return.no_lines"
        else:
            return_allowed = True
            return_reason = None
    push_return_cap = _require_supplier_for_push(_cap(return_allowed, return_reason), order)

    iqc_allowed = False
    iqc_reason = "purchase_order.push_incoming_inspection.not_audited"
    if _is_order_pushable_status(status):
        if not has_items:
            iqc_reason = "purchase_order.push_incoming_inspection.no_items"
        else:
            iqc_allowed = True
            iqc_reason = None
    push_incoming_inspection_cap = _require_supplier_for_push(_cap(iqc_allowed, iqc_reason), order)

    create_change_allowed = False
    create_change_reason = "purchase_order.create_change.not_allowed"
    if update_allowed:
        create_change_reason = "purchase_order.create_change.not_allowed"
    elif has_pending_change:
        create_change_reason = "purchase_order.create_change.pending_exists"
    elif not _is_audited_status(status):
        create_change_reason = "purchase_order.create_change.not_audited"
    elif not is_source_order_locked_for_direct_edit(_norm(status), review_status):
        create_change_reason = "purchase_order.create_change.not_allowed"
    elif not has_items:
        create_change_reason = "purchase_order.create_change.no_items"
    else:
        create_change_allowed = True
        create_change_reason = None
    create_change_cap = _cap(create_change_allowed, create_change_reason)

    revoke_allowed = False
    revoke_reason = "purchase_order.revoke_approval.not_allowed"
    if _is_audited_status(status) or _is_rejected_status(status):
        if has_downstream:
            revoke_reason = "purchase_order.revoke_approval.has_downstream"
        else:
            revoke_allowed = True
            revoke_reason = None
    revoke_cap = _cap(revoke_allowed, revoke_reason)

    print_cap = _cap(True)

    return PurchaseOrderCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        revoke_approval=revoke_cap,
        push_receipt_notice=push_receipt_notice_cap,
        push_receipt=push_receipt_cap,
        push_invoice=push_invoice_cap,
        push_prepayment=push_prepayment_cap,
        push_payment_application=push_payment_application_cap,
        push_purchase_return=push_return_cap,
        push_incoming_inspection=push_incoming_inspection_cap,
        create_change_order=create_change_cap,
        print=print_cap,
    )


def assert_purchase_order_capability(
    order: Any,
    action: str,
    *,
    has_items: bool = True,
    has_outstanding: bool = False,
    has_pushable_receipt_outstanding: bool = False,
    has_pushable_notice_outstanding: bool = False,
    has_received: bool = False,
    has_invoice: bool = False,
    has_receipt_notice: bool = False,
    has_downstream: bool = False,
    has_pending_change: bool = False,
    has_returnable: bool = False,
    has_prepayment_payment: bool = False,
    require_payment_application: bool = False,
    prepayment_application_remaining: Optional[Decimal] = None,
) -> None:
    caps = derive_purchase_order_capabilities(
        order,
        has_items=has_items,
        has_outstanding=has_outstanding,
        has_pushable_receipt_outstanding=has_pushable_receipt_outstanding,
        has_pushable_notice_outstanding=has_pushable_notice_outstanding,
        has_received=has_received,
        has_invoice=has_invoice,
        has_receipt_notice=has_receipt_notice,
        has_downstream=has_downstream,
        has_pending_change=has_pending_change,
        has_returnable=has_returnable,
        has_prepayment_payment=has_prepayment_payment,
        require_payment_application=require_payment_application,
        prepayment_application_remaining=prepayment_application_remaining,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "revoke_approval": caps.revoke_approval,
        "push_receipt_notice": caps.push_receipt_notice,
        "push_receipt": caps.push_receipt,
        "push_invoice": caps.push_invoice,
        "push_prepayment": caps.push_prepayment,
        "push_payment_application": caps.push_payment_application,
        "push_purchase_return": caps.push_purchase_return,
        "push_incoming_inspection": caps.push_incoming_inspection,
        "create_change_order": caps.create_change_order,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase order capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
