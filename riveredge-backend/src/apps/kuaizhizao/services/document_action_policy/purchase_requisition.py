"""采购申请业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import (
    DocumentStatus,
    ReviewStatus,
    is_draft_status,
    is_pending_review_status,
    normalize_status,
)
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PurchaseRequisitionCapabilities,
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


def _is_revoke_approval_allowed(status: Any) -> bool:
    normalized = normalize_status(_norm(status))
    return normalized in (
        DocumentStatus.AUDITED.value,
        DocumentStatus.CONFIRMED.value,
        DocumentStatus.PARTIAL_CONVERTED.value,
        DocumentStatus.FULL_CONVERTED.value,
        "已通过",
    )


def _can_push_downstream(status: Any) -> bool:
    normalized = normalize_status(_norm(status))
    return normalized in (
        DocumentStatus.AUDITED.value,
        DocumentStatus.CONFIRMED.value,
        DocumentStatus.PARTIAL_CONVERTED.value,
        "已通过",
    )


def derive_purchase_requisition_capabilities(
    req: Any,
    *,
    has_linked_purchase_order: bool = False,
) -> PurchaseRequisitionCapabilities:
    status = getattr(req, "status", None)

    update_allowed = is_draft_status(status or "") or is_pending_review_status(status or "")
    update_cap = _cap(
        update_allowed,
        "purchase_requisition.update.not_allowed" if not update_allowed else None,
    )

    delete_cap = _cap(
        is_draft_status(status or "") or is_pending_review_status(status or ""),
        "purchase_requisition.delete.not_allowed"
        if not (is_draft_status(status or "") or is_pending_review_status(status or ""))
        else None,
    )

    submit_cap = _cap(
        is_draft_status(status or ""),
        "purchase_requisition.submit.not_draft" if not is_draft_status(status or "") else None,
    )

    approve_cap = _cap(
        is_pending_review_status(status or ""),
        "purchase_requisition.approve.not_pending"
        if not is_pending_review_status(status or "")
        else None,
    )

    revoke_allowed = _is_revoke_approval_allowed(status) and not has_linked_purchase_order
    revoke_reason = None
    if has_linked_purchase_order:
        revoke_reason = "purchase_requisition.revoke_approval.has_purchase_order"
    elif not _is_revoke_approval_allowed(status):
        revoke_reason = "purchase_requisition.revoke_approval.not_allowed"
    revoke_cap = _cap(revoke_allowed, revoke_reason)

    push_downstream_allowed = _can_push_downstream(status)
    push_po_cap = _cap(
        push_downstream_allowed,
        "purchase_requisition.push_purchase_order.not_allowed"
        if not push_downstream_allowed
        else None,
    )
    push_inquiry_cap = _cap(
        push_downstream_allowed,
        "purchase_requisition.push_inquiry.not_allowed"
        if not push_downstream_allowed
        else None,
    )

    return PurchaseRequisitionCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        approve=approve_cap,
        revoke_approval=revoke_cap,
        push_purchase_order=push_po_cap,
        push_inquiry=push_inquiry_cap,
    )


def assert_purchase_requisition_capability(req: Any, action: str) -> None:
    caps = derive_purchase_requisition_capabilities(req)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "approve": caps.approve,
        "revoke_approval": caps.revoke_approval,
        "push_purchase_order": caps.push_purchase_order,
        "push_inquiry": caps.push_inquiry,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase requisition capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
