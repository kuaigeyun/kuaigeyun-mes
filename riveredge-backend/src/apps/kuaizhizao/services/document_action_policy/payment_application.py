"""付款申请单 capabilities"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import is_draft_status, is_pending_review_status
from apps.kuaizhizao.services.document_action_policy.types import ActionCapability


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_approved(status: Any) -> bool:
    s = _norm(status)
    return s in ("已批准", "部分付款", "已通过", "APPROVED", "AUDITED")


def derive_payment_application_capabilities(app: Any) -> dict[str, ActionCapability]:
    status = getattr(app, "status", None)
    remaining = getattr(app, "remaining_amount", 0) or 0

    update_ok = is_draft_status(status or "") or is_pending_review_status(status or "")
    delete_ok = is_draft_status(status or "")

    submit_ok = is_draft_status(status or "")
    approve_ok = is_pending_review_status(status or "")

    approved = _is_approved(status)
    push_ok = approved and float(remaining) > 0

    return {
        "update": _cap(update_ok, "payment_application.update.not_allowed" if not update_ok else None),
        "delete": _cap(delete_ok, "payment_application.delete.not_allowed" if not delete_ok else None),
        "submit": _cap(submit_ok, "payment_application.submit.not_allowed" if not submit_ok else None),
        "approve": _cap(approve_ok, "payment_application.approve.not_allowed" if not approve_ok else None),
        "reject": _cap(approve_ok, "payment_application.approve.not_allowed" if not approve_ok else None),
        "withdraw_submit": _cap(approve_ok, "payment_application.withdraw.not_allowed" if not approve_ok else None),
        "push_payment": _cap(
            push_ok,
            "payment_application.push_payment.not_allowed"
            if not push_ok
            else None,
        ),
        "print": _cap(True),
    }


def assert_payment_application_capability(app: Any, action: str) -> None:
    caps = derive_payment_application_capabilities(app)
    cap = caps.get(action)
    if not cap or not cap.allowed:
        reason = cap.reason if cap else "payment_application.action.not_allowed"
        raise BusinessLogicError(reason)
