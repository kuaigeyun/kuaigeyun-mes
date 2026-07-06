"""采购询价单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import DocumentStatus, LEGACY_PENDING_VALUES, ReviewStatus, normalize_status
from apps.kuaizhizao.constants.purchase_inquiry import PurchaseInquiryStatus
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PurchaseInquiryCapabilities,
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


def _is_review_pending(review_status: Any) -> bool:
    rs = _normalize_review_status(review_status)
    return rs in LEGACY_PENDING_VALUES or rs == ReviewStatus.PENDING.value or rs == DocumentStatus.PENDING_REVIEW.value


def derive_purchase_inquiry_capabilities(inquiry: Any) -> PurchaseInquiryCapabilities:
    status = getattr(inquiry, "status", None)
    review_status = getattr(inquiry, "review_status", None)
    st = _norm(status)

    update_allowed = st == PurchaseInquiryStatus.DRAFT.value
    update_cap = _cap(
        update_allowed,
        "purchase_inquiry.update.not_draft" if not update_allowed else None,
    )

    delete_cap = _cap(
        st == PurchaseInquiryStatus.DRAFT.value,
        "purchase_inquiry.delete.not_draft" if st != PurchaseInquiryStatus.DRAFT.value else None,
    )

    submit_cap = _cap(
        st == PurchaseInquiryStatus.DRAFT.value,
        "purchase_inquiry.submit.not_draft" if st != PurchaseInquiryStatus.DRAFT.value else None,
    )

    withdraw_submit_allowed = (
        st == PurchaseInquiryStatus.DRAFT.value and _is_review_pending(review_status)
    )
    withdraw_submit_cap = _cap(
        withdraw_submit_allowed,
        "purchase_inquiry.withdraw_submit.not_pending" if not withdraw_submit_allowed else None,
    )

    approve_cap = _cap(
        _is_review_pending(review_status),
        "purchase_inquiry.approve.not_pending" if not _is_review_pending(review_status) else None,
    )

    revoke_cap = _cap(True)

    push_po_cap = _cap(
        st == PurchaseInquiryStatus.AWARDED.value,
        "purchase_inquiry.push_purchase_order.not_allowed"
        if st != PurchaseInquiryStatus.AWARDED.value
        else None,
    )

    return PurchaseInquiryCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_submit_cap,
        approve=approve_cap,
        revoke_approval=revoke_cap,
        push_purchase_order=push_po_cap,
    )


def assert_purchase_inquiry_capability(inquiry: Any, action: str) -> None:
    caps = derive_purchase_inquiry_capabilities(inquiry)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "revoke_approval": caps.revoke_approval,
        "push_purchase_order": caps.push_purchase_order,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase inquiry capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
