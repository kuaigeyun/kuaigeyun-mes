"""采购退货单业务态 capabilities（与 sales_return 对称）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PurchaseReturnCapabilities,
)

_PENDING_STATUSES = frozenset({"待退货", "pending"})
_RETURNED_STATUSES = frozenset({"已退货", "completed", "已完成", "RETURNED"})
_CANCELLED_STATUSES = frozenset({"已取消", "CANCELLED", "cancelled"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_purchase_return_capabilities(
    return_doc: Any,
    *,
    has_items: bool = True,
) -> PurchaseReturnCapabilities:
    status = getattr(return_doc, "status", None)
    st = _norm(status)

    update_cap = _cap(
        st in _PENDING_STATUSES,
        "purchase_return.update.not_pending" if st not in _PENDING_STATUSES else None,
    )
    delete_cap = _cap(
        st in _PENDING_STATUSES,
        "purchase_return.delete.not_pending" if st not in _PENDING_STATUSES else None,
    )

    confirm_allowed = False
    confirm_reason = "purchase_return.confirm.not_pending"
    if st in _CANCELLED_STATUSES:
        confirm_reason = "purchase_return.confirm.cancelled"
    elif st in _RETURNED_STATUSES:
        confirm_reason = "purchase_return.confirm.already_returned"
    elif st not in _PENDING_STATUSES:
        confirm_reason = "purchase_return.confirm.not_pending"
    elif not has_items:
        confirm_reason = "purchase_return.confirm.no_items"
    else:
        confirm_allowed = True
        confirm_reason = None
    confirm_cap = _cap(confirm_allowed, confirm_reason)

    withdraw_cap = _cap(
        st in _RETURNED_STATUSES,
        "purchase_return.withdraw.not_returned" if st not in _RETURNED_STATUSES else None,
    )

    return PurchaseReturnCapabilities(
        update=update_cap,
        delete=delete_cap,
        confirm=confirm_cap,
        withdraw=withdraw_cap,
        print=_cap(True),
    )


def assert_purchase_return_capability(
    return_doc: Any,
    action: str,
    *,
    has_items: bool = True,
) -> None:
    caps = derive_purchase_return_capabilities(return_doc, has_items=has_items)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase return capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
