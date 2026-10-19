"""其他费用支出 capabilities"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    CAPABILITY_REASON_MESSAGES,
    ActionCapability,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _status(row: Any) -> str:
    return str(getattr(row, "status", "") or "").strip()


def _status_key(status: Any) -> str:
    """与前端 matchesAnyStatus 对齐：忽略大小写与下划线，并兼容中文态。"""
    raw = str(status or "").strip()
    if not raw:
        return ""
    if raw in {"草稿"}:
        return "draft"
    if raw in {"待审核"}:
        return "pendingreview"
    if raw in {"已驳回", "审核驳回", "驳回"}:
        return "rejected"
    if raw in {"已审核", "已通过", "审核通过"}:
        return "approved"
    if raw in {"已确认"}:
        return "confirmed"
    if raw in {"已取消", "已作废"}:
        return "cancelled"
    return raw.casefold().replace("_", "")


def is_other_expense_draft_status(st: str) -> bool:
    return _status_key(st) == "draft"


def is_other_expense_pending_status(st: str) -> bool:
    return _status_key(st) == "pendingreview"


def is_other_expense_approved_status(st: str) -> bool:
    return _status_key(st) == "approved"


def is_other_expense_confirmed_status(st: str) -> bool:
    return _status_key(st) == "confirmed"


def is_other_expense_rejected_status(st: str) -> bool:
    return _status_key(st) == "rejected"


def is_other_expense_cancelled_status(st: str) -> bool:
    return _status_key(st) == "cancelled"


def derive_other_expense_capabilities(
    row: Any,
    *,
    has_payable: bool = False,
    has_payment: bool = False,
) -> dict[str, ActionCapability]:
    st = _status(row)
    draft = is_other_expense_draft_status(st)
    pending = is_other_expense_pending_status(st)
    approved = is_other_expense_approved_status(st)
    confirmed = is_other_expense_confirmed_status(st)
    rejected = is_other_expense_rejected_status(st)
    cancelled = is_other_expense_cancelled_status(st)
    kind = str(getattr(row, "counterparty_kind", "") or "").strip().lower()
    needs_supplier = kind == "supplier"
    bank_ok = bool(getattr(row, "bank_account_id", None))

    update_ok = draft or rejected
    delete_ok = draft
    submit_ok = draft or rejected
    approve_ok = pending
    reject_ok = pending
    post_ok = (
        approved
        and not confirmed
        and not has_payment
        and has_payable
        and bank_ok
        and needs_supplier
    )
    confirm_reason = "other_expense.confirm.not_allowed"
    if approved and not confirmed:
        if not needs_supplier:
            confirm_reason = "other_expense.confirm.need_supplier"
        elif not has_payable:
            confirm_reason = "other_expense.confirm.no_payable"
        elif not bank_ok:
            confirm_reason = "other_expense.confirm.need_bank"
        elif has_payment:
            confirm_reason = "other_expense.confirm.already_posted"
    confirm_ok = post_ok
    push_payment_ok = post_ok
    unconfirm_ok = confirmed
    cancel_ok = approved or confirmed

    return {
        "update": _cap(update_ok, "other_expense.update.not_allowed" if not update_ok else None),
        "delete": _cap(delete_ok, "other_expense.delete.not_allowed" if not delete_ok else None),
        "submit": _cap(submit_ok, "other_expense.submit.not_allowed" if not submit_ok else None),
        "approve": _cap(approve_ok, "other_expense.approve.not_allowed" if not approve_ok else None),
        "reject": _cap(reject_ok, "other_expense.reject.not_allowed" if not reject_ok else None),
        "confirm": _cap(confirm_ok, confirm_reason if not confirm_ok else None),
        "push_payment": _cap(
            push_payment_ok,
            confirm_reason if not push_payment_ok else None,
        ),
        "unconfirm": _cap(unconfirm_ok, "other_expense.unconfirm.not_allowed" if not unconfirm_ok else None),
        "cancel": _cap(cancel_ok and not cancelled, "other_expense.cancel.not_allowed" if not (cancel_ok and not cancelled) else None),
        "print": _cap(True),
        "export": _cap(True),
    }


def assert_other_expense_capability(row: Any, action: str) -> None:
    caps = derive_other_expense_capabilities(row)
    cap = caps.get(action)
    if not cap or not cap.allowed:
        reason = cap.reason if cap else "other_expense.action.not_allowed"
        raise BusinessLogicError(
            CAPABILITY_REASON_MESSAGES.get(reason, reason)
        )
