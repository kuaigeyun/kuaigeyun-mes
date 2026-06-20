"""收货通知单业务态 capabilities（与 shipment_notice 对称）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ReceiptNoticeCapabilities,
)

_PENDING_STATUS = "待收货"
_NOTIFIED_STATUS = "已通知"
_RECEIPT_WITHDRAWABLE = frozenset({"草稿", "draft", "DRAFT", "待入库"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_pending(status: Any) -> bool:
    return _norm(status) == _PENDING_STATUS


def _is_notified(status: Any) -> bool:
    return _norm(status) == _NOTIFIED_STATUS


def derive_receipt_notice_capabilities(
    notice: Any,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    receipt_withdrawable: bool = True,
) -> ReceiptNoticeCapabilities:
    status = getattr(notice, "status", None)

    update_cap = _cap(
        _is_pending(status),
        "receipt_notice.update.not_pending" if not _is_pending(status) else None,
    )
    delete_cap = _cap(
        _is_pending(status),
        "receipt_notice.delete.not_pending" if not _is_pending(status) else None,
    )

    notify_allowed = False
    notify_reason = "receipt_notice.notify.not_pending"
    if not _is_pending(status):
        notify_reason = "receipt_notice.notify.not_pending"
    elif getattr(notice, "purchase_receipt_id", None):
        notify_reason = "receipt_notice.notify.already_notified"
    elif not has_items:
        notify_reason = "receipt_notice.notify.no_items"
    elif not has_warehouse:
        notify_reason = "receipt_notice.notify.no_warehouse"
    else:
        notify_allowed = True
        notify_reason = None
    notify_cap = _cap(notify_allowed, notify_reason)

    withdraw_allowed = False
    withdraw_reason = "receipt_notice.withdraw.not_notified"
    if not _is_notified(status):
        withdraw_reason = "receipt_notice.withdraw.not_notified"
    elif not receipt_withdrawable:
        withdraw_reason = "receipt_notice.withdraw.receipt_processing"
    else:
        withdraw_allowed = True
        withdraw_reason = None
    withdraw_cap = _cap(withdraw_allowed, withdraw_reason)

    return ReceiptNoticeCapabilities(
        update=update_cap,
        delete=delete_cap,
        notify=notify_cap,
        withdraw=withdraw_cap,
        print=_cap(True),
    )


def assert_receipt_notice_capability(
    notice: Any,
    action: str,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    receipt_withdrawable: bool = True,
) -> None:
    caps = derive_receipt_notice_capabilities(
        notice,
        has_items=has_items,
        has_warehouse=has_warehouse,
        receipt_withdrawable=receipt_withdrawable,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "notify": caps.notify,
        "withdraw": caps.withdraw,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown receipt notice capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
