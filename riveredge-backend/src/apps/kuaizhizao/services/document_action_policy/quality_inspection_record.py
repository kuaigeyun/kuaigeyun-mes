"""检验单业务态 capabilities（来料/过程/成品，与 quality_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    QualityInspectionCapabilities,
)

_PENDING_REVIEW_STATUSES = frozenset({"待审核", "PENDING", "pending_review", "PENDING_REVIEW"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_pending_review(review_status: Any) -> bool:
    return _norm(review_status) in _PENDING_REVIEW_STATUSES


def derive_quality_inspection_capabilities(
    inspection: Any,
    *,
    supports_purchase_return: bool = False,
) -> QualityInspectionCapabilities:
    status = _norm(getattr(inspection, "status", None))
    review_status = _norm(getattr(inspection, "review_status", None))
    quality_status = _norm(getattr(inspection, "quality_status", None))
    inspection_result = _norm(getattr(inspection, "inspection_result", None))
    unqualified_qty = float(getattr(inspection, "unqualified_quantity", 0) or 0)

    conduct_allowed = status == "待检验" or inspection_result == "待检验"
    conduct_cap = _cap(
        conduct_allowed,
        "quality_inspection.conduct.not_pending" if not conduct_allowed else None,
    )

    pending_audit = _is_pending_review(review_status) and status in ("已检验", "待审核")
    approve_cap = _cap(
        pending_audit,
        "quality_inspection.approve.not_pending" if not pending_audit else None,
    )
    reject_cap = approve_cap

    defect_allowed = (
        quality_status == "不合格"
        and unqualified_qty > 0
        and status == "已检验"
    )
    create_defect_cap = _cap(
        defect_allowed,
        "quality_inspection.create_defect.not_allowed" if not defect_allowed else None,
    )

    push_return_allowed = supports_purchase_return and defect_allowed
    push_return_cap = _cap(
        push_return_allowed,
        "quality_inspection.push_purchase_return.not_allowed" if not push_return_allowed else None,
    )

    update_cap = _cap(
        status == "待检验",
        "quality_inspection.update.not_pending" if status != "待检验" else None,
    )

    print_cap = _cap(True)

    return QualityInspectionCapabilities(
        conduct=conduct_cap,
        approve=approve_cap,
        reject=reject_cap,
        create_defect=create_defect_cap,
        push_purchase_return=push_return_cap,
        update=update_cap,
        print=print_cap,
    )


def assert_quality_inspection_capability(
    inspection: Any,
    action: str,
    *,
    supports_purchase_return: bool = False,
) -> None:
    caps = derive_quality_inspection_capabilities(
        inspection,
        supports_purchase_return=supports_purchase_return,
    )
    cap_map = {
        "conduct": caps.conduct,
        "approve": caps.approve,
        "reject": caps.reject,
        "create_defect": caps.create_defect,
        "push_purchase_return": caps.push_purchase_return,
        "update": caps.update,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown quality inspection capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
