"""OQC 出货检验业务态 capabilities（与 quality_improvement_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
    can_conduct_quality_inspection,
)
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    OQCInspectionCapabilities,
)

_PENDING_REVIEW_STATUSES = frozenset({"待审核", "PENDING", "pending_review", "PENDING_REVIEW"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_pending_review(review_status: Any) -> bool:
    return _norm(review_status) in _PENDING_REVIEW_STATUSES


def derive_oqc_inspection_capabilities(inspection: Any) -> OQCInspectionCapabilities:
    status = _norm(getattr(inspection, "status", None))
    review_status = _norm(getattr(inspection, "review_status", None))
    inspection_result = _norm(getattr(inspection, "inspection_result", None))

    conduct_allowed = can_conduct_quality_inspection(status, inspection_result)
    conduct_cap = _cap(
        conduct_allowed,
        "oqc_inspection.conduct.approved_locked" if not conduct_allowed else None,
    )

    pending_audit = _is_pending_review(review_status) and status in ("已检验", "待审核")
    approve_cap = _cap(
        pending_audit,
        "oqc_inspection.approve.not_pending" if not pending_audit else None,
    )
    reject_cap = approve_cap

    revoke_cap = _cap(
        status == "已审核",
        "oqc_inspection.revoke_approval.not_approved" if status != "已审核" else None,
    )

    delete_cap = _cap(
        status == "待检验",
        "oqc_inspection.delete.not_pending" if status != "待检验" else None,
    )

    print_cap = _cap(True)

    return OQCInspectionCapabilities(
        conduct=conduct_cap,
        approve=approve_cap,
        reject=reject_cap,
        revoke_approval=revoke_cap,
        delete=delete_cap,
        print=print_cap,
    )


def assert_oqc_inspection_capability(inspection: Any, action: str) -> None:
    caps = derive_oqc_inspection_capabilities(inspection)
    cap_map = {
        "conduct": caps.conduct,
        "approve": caps.approve,
        "reject": caps.reject,
        "revoke_approval": caps.revoke_approval,
        "delete": caps.delete,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown OQC inspection capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
