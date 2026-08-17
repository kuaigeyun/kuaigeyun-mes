"""采购退货单业务态 capabilities（与 sales_return 对称，含审核动作）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PurchaseReturnCapabilities,
)

_PENDING_STATUSES = frozenset({"待退货", "pending"})
_DRAFT_STATUSES = frozenset({"草稿", "DRAFT", "draft"})
_RETURNED_STATUSES = frozenset({"已退货", "completed", "已完成", "RETURNED"})
_CANCELLED_STATUSES = frozenset({"已取消", "CANCELLED", "cancelled"})
_REVIEW_DRAFT = frozenset({"草稿", "draft", ""})
_REVIEW_PENDING = frozenset({"待审核", "pending_review", "pending_approval", "pending", "PENDING"})
_REVIEW_APPROVED = frozenset({"审核通过", "已通过", "approved", "APPROVED", "通过"})
_REVIEW_REJECTED = frozenset({"审核驳回", "已驳回", "rejected", "REJECTED", "驳回"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _norm_review(value: Any) -> str:
    return str(value or "").strip().lower()


def _is_pending(status: Any) -> bool:
    return _norm_status(status) in _PENDING_STATUSES


def _is_draft(status: Any) -> bool:
    return _norm_status(status) in _DRAFT_STATUSES


def _is_returned(status: Any) -> bool:
    return _norm_status(status) in _RETURNED_STATUSES


def _is_cancelled(status: Any) -> bool:
    return _norm_status(status) in _CANCELLED_STATUSES


def _is_review_draft(review_status: Any) -> bool:
    raw = _norm_status(review_status)
    return raw in _REVIEW_DRAFT or _norm_review(review_status) in _REVIEW_DRAFT


def _is_review_pending(review_status: Any) -> bool:
    raw = _norm_status(review_status)
    lowered = _norm_review(review_status)
    return raw in _REVIEW_PENDING or lowered in _REVIEW_PENDING


def _is_review_approved(review_status: Any) -> bool:
    raw = _norm_status(review_status)
    lowered = _norm_review(review_status)
    return raw in _REVIEW_APPROVED or lowered in _REVIEW_APPROVED


def _is_review_rejected(review_status: Any) -> bool:
    raw = _norm_status(review_status)
    lowered = _norm_review(review_status)
    return raw in _REVIEW_REJECTED or lowered in _REVIEW_REJECTED


def _is_editable_business_status(status: Any) -> bool:
    return _is_pending(status) or _is_draft(status)


def derive_purchase_return_capabilities(
    return_doc: Any,
    *,
    has_items: bool = True,
    audit_required: bool = False,
) -> PurchaseReturnCapabilities:
    status = getattr(return_doc, "status", None)
    review_status = getattr(return_doc, "review_status", None)

    review_blocks_edit = audit_required and (
        _is_review_pending(review_status) or _is_review_approved(review_status)
    )
    update_allowed = _is_editable_business_status(status) and not review_blocks_edit
    if _is_review_rejected(review_status):
        update_allowed = _is_editable_business_status(status)
    update_cap = _cap(
        update_allowed,
        "purchase_return.update.not_pending" if not update_allowed else None,
    )

    delete_allowed = _is_pending(status) and (
        not audit_required or _is_review_draft(review_status) or _is_review_rejected(review_status)
    )
    delete_cap = _cap(
        delete_allowed,
        "purchase_return.delete.not_pending" if not delete_allowed else None,
    )

    confirm_allowed = False
    confirm_reason = "purchase_return.confirm.not_pending"
    if _is_cancelled(status):
        confirm_reason = "purchase_return.confirm.cancelled"
    elif _is_returned(status):
        confirm_reason = "purchase_return.confirm.already_returned"
    elif not _is_pending(status):
        confirm_reason = "purchase_return.confirm.not_pending"
    elif not has_items:
        confirm_reason = "purchase_return.confirm.no_items"
    elif audit_required and not _is_review_approved(review_status):
        confirm_reason = "purchase_return.confirm.not_audited"
    else:
        confirm_allowed = True
        confirm_reason = None
    confirm_cap = _cap(confirm_allowed, confirm_reason)

    withdraw_cap = _cap(
        _is_returned(status),
        "purchase_return.withdraw.not_returned" if not _is_returned(status) else None,
    )

    submit_allowed = False
    submit_reason = "purchase_return.submit.not_draft"
    if _is_cancelled(status) or _is_returned(status):
        submit_reason = "purchase_return.submit.not_draft"
    elif not _is_editable_business_status(status):
        submit_reason = "purchase_return.submit.not_draft"
    elif not has_items:
        submit_reason = "purchase_return.submit.no_items"
    elif _is_review_pending(review_status) or _is_review_approved(review_status):
        submit_reason = "purchase_return.submit.not_draft"
    elif _is_review_draft(review_status) or _is_review_rejected(review_status):
        submit_allowed = True
        submit_reason = None
    submit_cap = _cap(submit_allowed, submit_reason)

    withdraw_submit_cap = _cap(
        _is_editable_business_status(status) and _is_review_pending(review_status),
        "purchase_return.withdraw_submit.not_pending"
        if not (_is_editable_business_status(status) and _is_review_pending(review_status))
        else None,
    )

    approve_cap = _cap(
        _is_review_pending(review_status),
        "purchase_return.approve.not_pending" if not _is_review_pending(review_status) else None,
    )

    revoke_allowed = (
        _is_editable_business_status(status)
        and _is_review_approved(review_status)
        and not _is_returned(status)
    )
    revoke_cap = _cap(
        revoke_allowed,
        "purchase_return.revoke_approval.not_allowed" if not revoke_allowed else None,
    )

    return PurchaseReturnCapabilities(
        update=update_cap,
        delete=delete_cap,
        confirm=confirm_cap,
        withdraw=withdraw_cap,
        print=_cap(True),
        submit=submit_cap,
        withdraw_submit=withdraw_submit_cap,
        approve=approve_cap,
        revoke_approval=revoke_cap,
    )


def assert_purchase_return_capability(
    return_doc: Any,
    action: str,
    *,
    has_items: bool = True,
    audit_required: bool = False,
) -> None:
    caps = derive_purchase_return_capabilities(
        return_doc,
        has_items=has_items,
        audit_required=audit_required,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "print": caps.print,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "reject": caps.approve,
        "revoke_approval": caps.revoke_approval,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase return capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
