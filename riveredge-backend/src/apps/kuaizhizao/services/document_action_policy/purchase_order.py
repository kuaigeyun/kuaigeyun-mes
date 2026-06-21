"""采购订单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import (
    DocumentStatus,
    LEGACY_AUDITED_VALUES,
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


def _is_rejected_status(status: Any) -> bool:
    raw = _norm(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.REJECTED.value or raw in ("已驳回", "rejected", "REJECTED")


def derive_purchase_order_capabilities(
    order: Any,
    *,
    has_items: bool = True,
    has_outstanding: bool = False,
    has_downstream: bool = False,
) -> PurchaseOrderCapabilities:
    status = getattr(order, "status", None)
    review_status = getattr(order, "review_status", None)

    update_allowed = is_draft_status(status or "") or is_pending_review_status(status or "")
    update_cap = _cap(
        update_allowed,
        "purchase_order.update.not_allowed" if not update_allowed else None,
    )

    delete_cap = _cap(
        is_draft_status(status or "") or is_pending_review_status(status or ""),
        "purchase_order.delete.not_allowed"
        if not (is_draft_status(status or "") or is_pending_review_status(status or ""))
        else None,
    )

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

    push_allowed = False
    push_reason = "purchase_order.push_receipt.not_audited"
    if _is_audited_status(status):
        if not has_items:
            push_reason = "purchase_order.push_receipt.no_items"
        elif not has_outstanding:
            push_reason = "purchase_order.push_receipt.no_outstanding"
        else:
            push_allowed = True
            push_reason = None
    push_cap = _cap(push_allowed, push_reason)

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
        push_receipt_notice=push_cap,
        print=print_cap,
    )


def assert_purchase_order_capability(
    order: Any,
    action: str,
    *,
    has_items: bool = True,
    has_outstanding: bool = False,
    has_downstream: bool = False,
) -> None:
    caps = derive_purchase_order_capabilities(
        order,
        has_items=has_items,
        has_outstanding=has_outstanding,
        has_downstream=has_downstream,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "revoke_approval": caps.revoke_approval,
        "push_receipt_notice": caps.push_receipt_notice,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase order capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
