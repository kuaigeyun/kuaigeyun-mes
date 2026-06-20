"""报工记录业务态 capabilities（唯一真源，与 reporting_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ReportingRecordCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_reporting_record_capabilities(record: Any) -> ReportingRecordCapabilities:
    status = _norm(getattr(record, "status", None))

    update_cap = _cap(
        status == "pending",
        "reporting_record.update.not_pending" if status != "pending" else None,
    )
    delete_cap = _cap(
        status == "pending",
        "reporting_record.delete.not_pending" if status != "pending" else None,
    )

    revoke_cap = _cap(
        status == "approved",
        "reporting_record.revoke_approval.not_approved" if status != "approved" else None,
    )

    print_cap = _cap(True)

    return ReportingRecordCapabilities(
        update=update_cap,
        delete=delete_cap,
        revoke_approval=revoke_cap,
        print=print_cap,
    )


def assert_reporting_record_capability(record: Any, action: str) -> None:
    caps = derive_reporting_record_capabilities(record)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "revoke_approval": caps.revoke_approval,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown reporting record capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
