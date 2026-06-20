"""不合格品台账业务态 capabilities（与 defect_record_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    NonconformingLedgerCapabilities,
)

_CLOSED_STATUSES = frozenset({"processed", "cancelled"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_nonconforming_ledger_capabilities(
    record: Any,
    *,
    has_linked_8d_report: bool = False,
) -> NonconformingLedgerCapabilities:
    status = _norm(getattr(record, "status", None))
    is_closed = status in _CLOSED_STATUSES

    update_cap = _cap(
        not is_closed,
        "nonconforming_ledger.update.closed" if is_closed else None,
    )

    start_8d_allowed = not is_closed and not has_linked_8d_report
    start_8d_cap = _cap(
        start_8d_allowed,
        "nonconforming_ledger.start_8d.already_linked"
        if has_linked_8d_report
        else "nonconforming_ledger.start_8d.closed"
        if is_closed
        else None,
    )

    print_cap = _cap(True)

    return NonconformingLedgerCapabilities(
        update_disposition=update_cap,
        start_8d=start_8d_cap,
        print=print_cap,
    )


def assert_nonconforming_ledger_capability(
    record: Any,
    action: str,
    *,
    has_linked_8d_report: bool = False,
) -> None:
    caps = derive_nonconforming_ledger_capabilities(
        record,
        has_linked_8d_report=has_linked_8d_report,
    )
    cap_map = {
        "update_disposition": caps.update_disposition,
        "start_8d": caps.start_8d,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown nonconforming ledger capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
