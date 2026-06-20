"""销售退货单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    SalesReturnCapabilities,
)

_PENDING_STATUSES = frozenset({"待退货", "pending"})
_DRAFT_STATUSES = frozenset({"草稿", "DRAFT", "draft"})
_RETURNED_STATUSES = frozenset({"已退货", "completed", "已完成", "RETURNED"})
_CANCELLED_STATUSES = frozenset({"已取消", "CANCELLED", "cancelled"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_pending(status: Any) -> bool:
    return _norm_status(status) in _PENDING_STATUSES


def _is_draft(status: Any) -> bool:
    return _norm_status(status) in _DRAFT_STATUSES


def _is_returned(status: Any) -> bool:
    return _norm_status(status) in _RETURNED_STATUSES


def _is_cancelled(status: Any) -> bool:
    return _norm_status(status) in _CANCELLED_STATUSES


def derive_sales_return_capabilities(
    return_doc: Any,
    *,
    has_items: bool = True,
) -> SalesReturnCapabilities:
    status = getattr(return_doc, "status", None)

    update_allowed = _is_pending(status) or _is_draft(status)
    update_cap = _cap(
        update_allowed,
        "sales_return.update.not_editable" if not update_allowed else None,
    )

    delete_allowed = _is_pending(status)
    delete_cap = _cap(
        delete_allowed,
        "sales_return.delete.not_pending" if not delete_allowed else None,
    )

    confirm_allowed = False
    confirm_reason = "sales_return.confirm.not_pending"
    if _is_cancelled(status):
        confirm_reason = "sales_return.confirm.cancelled"
    elif _is_returned(status):
        confirm_reason = "sales_return.confirm.already_returned"
    elif not _is_pending(status):
        confirm_reason = "sales_return.confirm.not_pending"
    elif not has_items:
        confirm_reason = "sales_return.confirm.no_items"
    else:
        confirm_allowed = True
        confirm_reason = None
    confirm_cap = _cap(confirm_allowed, confirm_reason)

    withdraw_allowed = _is_returned(status)
    withdraw_cap = _cap(
        withdraw_allowed,
        "sales_return.withdraw.not_returned" if not withdraw_allowed else None,
    )

    print_cap = _cap(True)

    return SalesReturnCapabilities(
        update=update_cap,
        delete=delete_cap,
        confirm=confirm_cap,
        withdraw=withdraw_cap,
        print=print_cap,
    )


def assert_sales_return_capability(
    return_doc: Any,
    action: str,
    *,
    has_items: bool = True,
) -> None:
    caps = derive_sales_return_capabilities(return_doc, has_items=has_items)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown sales return capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
