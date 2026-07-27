"""委外工单业务态 capabilities（出库发料 + 入库收货/退料/退货加载门禁）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    OutsourceWorkOrderCapabilities,
)
from apps.kuaizhizao.utils.outsource_work_order_state import (
    outsource_work_order_has_execution_activity,
    outsource_work_order_is_fully_received,
)

_PUSH_ACTIVE_STATUSES = frozenset({"released", "in_progress"})
_TERMINAL_STATUSES = frozenset({"completed", "cancelled"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _push_cap(
    record: Any,
    not_allowed_reason: str,
    frozen_reason: str,
) -> ActionCapability:
    status = _norm(getattr(record, "status", None))
    is_frozen = bool(getattr(record, "is_frozen", False))
    push_allowed = not is_frozen and status in _PUSH_ACTIVE_STATUSES
    push_reason = None
    if is_frozen:
        push_reason = frozen_reason
    elif status in _TERMINAL_STATUSES:
        push_reason = not_allowed_reason
    elif not push_allowed:
        push_reason = not_allowed_reason
    return _cap(push_allowed, push_reason)


def derive_outsource_work_order_capabilities(record: Any) -> OutsourceWorkOrderCapabilities:
    status = _norm(getattr(record, "status", None))
    has_activity = outsource_work_order_has_execution_activity(record)
    fully_received = outsource_work_order_is_fully_received(record)

    cancel_allowed = False
    cancel_reason = "outsource_work_order.cancel.not_allowed"
    if status == "draft":
        cancel_allowed = True
        cancel_reason = None
    elif status == "released" and not has_activity:
        cancel_allowed = True
        cancel_reason = None
    elif status == "cancelled":
        cancel_reason = "outsource_work_order.cancel.already_cancelled"
    elif status == "completed":
        cancel_reason = "outsource_work_order.cancel.completed"
    elif status == "in_progress":
        cancel_reason = "outsource_work_order.cancel.in_progress_use_close"
    elif status == "released" and has_activity:
        cancel_reason = "outsource_work_order.cancel.has_activity"

    close_allowed = False
    close_reason = "outsource_work_order.close.not_allowed"
    if status in _TERMINAL_STATUSES:
        close_reason = (
            "outsource_work_order.close.already_completed"
            if status == "completed"
            else "outsource_work_order.close.cancelled"
        )
    elif fully_received:
        close_reason = "outsource_work_order.close.fully_received"
    elif status == "in_progress":
        close_allowed = True
        close_reason = None
    elif status == "released" and has_activity:
        close_allowed = True
        close_reason = None
    elif status == "released":
        close_reason = "outsource_work_order.close.no_activity_use_cancel"

    return OutsourceWorkOrderCapabilities(
        push_outsource_issue=_push_cap(
            record,
            "outsource_work_order.push_outsource_issue.not_allowed",
            "outsource_work_order.push_outsource_issue.frozen",
        ),
        push_outsource_receipt=_push_cap(
            record,
            "outsource_work_order.push_outsource_receipt.not_allowed",
            "outsource_work_order.push_outsource_receipt.frozen",
        ),
        push_outsource_material_return=_push_cap(
            record,
            "outsource_work_order.push_outsource_material_return.not_allowed",
            "outsource_work_order.push_outsource_material_return.frozen",
        ),
        push_outsource_product_return=_push_cap(
            record,
            "outsource_work_order.push_outsource_product_return.not_allowed",
            "outsource_work_order.push_outsource_product_return.frozen",
        ),
        cancel=_cap(cancel_allowed, cancel_reason),
        close=_cap(close_allowed, close_reason),
        print=_cap(True),
    )


def assert_outsource_work_order_capability(record: Any, action: str) -> None:
    caps = derive_outsource_work_order_capabilities(record)
    cap_map = {
        "push_outsource_issue": caps.push_outsource_issue,
        "push_outsource_receipt": caps.push_outsource_receipt,
        "push_outsource_material_return": caps.push_outsource_material_return,
        "push_outsource_product_return": caps.push_outsource_product_return,
        "cancel": caps.cancel,
        "close": caps.close,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown outsource work order capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
