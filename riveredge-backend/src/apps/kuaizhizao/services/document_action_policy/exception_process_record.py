"""异常处理记录业务态 capabilities（唯一真源，与 exception_process_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ExceptionProcessRecordCapabilities,
)

_TERMINAL_STATUSES = frozenset({"resolved", "cancelled"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_exception_process_record_capabilities(record: Any) -> ExceptionProcessRecordCapabilities:
    process_status = _norm(getattr(record, "process_status", None))
    is_terminal = process_status in _TERMINAL_STATUSES

    cancel_cap = _cap(
        not is_terminal,
        "exception_process.cancel.already_finished" if is_terminal else None,
    )
    print_cap = _cap(True)

    return ExceptionProcessRecordCapabilities(
        cancel=cancel_cap,
        print=print_cap,
    )


def assert_exception_process_record_capability(record: Any, action: str) -> None:
    caps = derive_exception_process_record_capabilities(record)
    cap_map = {
        "cancel": caps.cancel,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown exception process record capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
