"""发货通知单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ShipmentNoticeCapabilities,
)

_PENDING_STATUS = "待发货"
_NOTIFIED_STATUS = "已通知"
_SHIPPED_STATUS = "已出库"
_DELIVERY_WITHDRAWABLE_STATUSES = frozenset({"草稿", "draft", "待出库"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_pending(status: Any) -> bool:
    return _norm_status(status) == _PENDING_STATUS


def _is_notified(status: Any) -> bool:
    return _norm_status(status) == _NOTIFIED_STATUS


def derive_shipment_notice_capabilities(
    notice: Any,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    delivery_withdrawable: bool = True,
) -> ShipmentNoticeCapabilities:
    status = getattr(notice, "status", None)

    update_cap = _cap(
        _is_pending(status),
        "shipment_notice.update.not_pending" if not _is_pending(status) else None,
    )
    delete_cap = _cap(
        _is_pending(status),
        "shipment_notice.delete.not_pending" if not _is_pending(status) else None,
    )

    notify_allowed = False
    notify_reason = "shipment_notice.notify.not_pending"
    if not _is_pending(status):
        notify_reason = "shipment_notice.notify.not_pending"
    elif not has_warehouse:
        notify_reason = "shipment_notice.notify.no_warehouse"
    elif not has_items:
        notify_reason = "shipment_notice.notify.no_items"
    else:
        notify_allowed = True
        notify_reason = None
    notify_cap = _cap(notify_allowed, notify_reason)

    withdraw_allowed = False
    withdraw_reason = "shipment_notice.withdraw.not_notified"
    if not _is_notified(status):
        withdraw_reason = "shipment_notice.withdraw.not_notified"
    elif not delivery_withdrawable:
        withdraw_reason = "shipment_notice.withdraw.delivery_processing"
    else:
        withdraw_allowed = True
        withdraw_reason = None
    withdraw_cap = _cap(withdraw_allowed, withdraw_reason)

    print_cap = _cap(True)

    return ShipmentNoticeCapabilities(
        update=update_cap,
        delete=delete_cap,
        notify=notify_cap,
        withdraw=withdraw_cap,
        print=print_cap,
    )


def assert_shipment_notice_capability(
    notice: Any,
    action: str,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    delivery_withdrawable: bool = True,
) -> None:
    caps = derive_shipment_notice_capabilities(
        notice,
        has_items=has_items,
        has_warehouse=has_warehouse,
        delivery_withdrawable=delivery_withdrawable,
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
        raise ValueError(f"Unknown shipment notice capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
