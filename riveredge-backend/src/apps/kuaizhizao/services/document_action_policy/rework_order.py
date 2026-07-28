"""返工单业务态 capabilities（唯一真源）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ReworkOrderCapabilities,
)
from apps.kuaizhizao.utils.rework_order_constants import (
    ROUTING_MODE_DYNAMIC,
    TERMINAL_REWORK_ORDER_STATUSES,
)

_TERMINAL = TERMINAL_REWORK_ORDER_STATUSES | frozenset({"cancelled"})

_CAPABILITY_CONTEXT_KEYS = frozenset({
    "has_reports",
    "current_op_completed",
    "has_completed_operation",
    "awaiting_route_decision",
    "verification_passed",
})


def capability_kwargs_from_context(ctx: dict[str, Any]) -> dict[str, Any]:
    """从 compute_capability_context 结果提取 derive_rework_order_capabilities 可接受参数。"""
    return {key: ctx[key] for key in _CAPABILITY_CONTEXT_KEYS if key in ctx}


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _dec(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def derive_rework_order_capabilities(
    record: Any,
    *,
    has_reports: bool = False,
    current_op_completed: bool = False,
    has_completed_operation: bool = False,
    awaiting_route_decision: bool = False,
    verification_passed: bool = False,
) -> ReworkOrderCapabilities:
    status = _norm(getattr(record, "status", None))
    routing_mode = _norm(getattr(record, "routing_mode", ROUTING_MODE_DYNAMIC))
    verification_required = bool(getattr(record, "verification_required", False))
    is_terminal = status in _TERMINAL

    update_allowed = status == "draft"
    update_cap = _cap(update_allowed, "rework_order.update.not_draft" if not update_allowed else None)

    delete_allowed = status in ("draft", "cancelled") or (status == "released" and not has_reports)
    delete_cap = _cap(
        delete_allowed,
        "rework_order.delete.not_allowed" if not delete_allowed else None,
    )

    release_allowed = status == "draft"
    release_cap = _cap(release_allowed, "rework_order.release.not_draft" if not release_allowed else None)

    execute_allowed = status in ("released", "in_progress") and not awaiting_route_decision
    execute_cap = _cap(
        execute_allowed,
        "rework_order.execute.awaiting_decision"
        if awaiting_route_decision
        else "rework_order.execute.not_allowed"
        if not execute_allowed
        else None,
    )

    advance_allowed = (
        routing_mode == ROUTING_MODE_DYNAMIC
        and status == "in_progress"
        and awaiting_route_decision
    )
    advance_cap = _cap(
        advance_allowed,
        "rework_order.advance.not_dynamic" if routing_mode != ROUTING_MODE_DYNAMIC else "rework_order.advance.not_allowed"
        if not advance_allowed
        else None,
    )

    request_complete_allowed = (
        status == "in_progress"
        and has_completed_operation
        and (awaiting_route_decision or current_op_completed or routing_mode != ROUTING_MODE_DYNAMIC)
    )
    request_complete_cap = _cap(
        request_complete_allowed,
        "rework_order.request_complete.not_allowed" if not request_complete_allowed else None,
    )

    quality_release_allowed = status == "pending_verification" and verification_passed
    quality_release_cap = _cap(
        quality_release_allowed,
        "rework_order.quality_release.verification_pending"
        if status == "pending_verification" and not verification_passed
        else "rework_order.quality_release.not_allowed"
        if not quality_release_allowed
        else None,
    )

    close_allowed = status == "quality_released" or (
        status == "pending_verification" and not verification_required
    )
    close_cap = _cap(
        close_allowed,
        "rework_order.close.not_allowed" if not close_allowed else None,
    )

    cancel_allowed = False
    cancel_reason = "rework_order.cancel.not_allowed"
    if status == "draft":
        cancel_allowed = True
        cancel_reason = None
    elif status == "released" and not has_reports:
        cancel_allowed = True
        cancel_reason = None
    elif status == "cancelled":
        cancel_reason = "rework_order.cancel.already_cancelled"
    elif is_terminal:
        cancel_reason = "rework_order.cancel.terminal"

    hold_allowed = status in ("released", "in_progress")
    hold_cap = _cap(hold_allowed, "rework_order.hold.not_allowed" if not hold_allowed else None)

    resume_allowed = status == "on_hold"
    resume_cap = _cap(resume_allowed, "rework_order.resume.not_on_hold" if not resume_allowed else None)

    return ReworkOrderCapabilities(
        update=update_cap,
        delete=delete_cap,
        release=release_cap,
        execute=execute_cap,
        advance_next=advance_cap,
        request_complete=request_complete_cap,
        quality_release=quality_release_cap,
        close=close_cap,
        cancel=_cap(cancel_allowed, cancel_reason),
        hold=hold_cap,
        resume=resume_cap,
        print=_cap(not is_terminal or status == "closed"),
    )


def assert_rework_order_capability(record: Any, action: str, caps: Optional[ReworkOrderCapabilities] = None) -> None:
    resolved = caps or derive_rework_order_capabilities(record)
    cap_map = {
        "update": resolved.update,
        "delete": resolved.delete,
        "release": resolved.release,
        "execute": resolved.execute,
        "advance_next": resolved.advance_next,
        "request_complete": resolved.request_complete,
        "quality_release": resolved.quality_release,
        "close": resolved.close,
        "cancel": resolved.cancel,
        "hold": resolved.hold,
        "resume": resolved.resume,
        "print": resolved.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown rework order capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
