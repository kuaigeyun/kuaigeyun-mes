"""检验单业务态 capabilities（来料/过程/成品，与 quality_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    QualityInspectionCapabilities,
)
from apps.kuaizhizao.services.quality_inspection_lifecycle import (
    can_revoke_quality_inspection_conduct,
)

_PENDING_REVIEW_STATUSES = frozenset({"待审核", "PENDING", "pending_review", "PENDING_REVIEW"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_pending_review(review_status: Any) -> bool:
    return _norm(review_status) in _PENDING_REVIEW_STATUSES


_CONDUCT_ALLOWED_STATUSES = frozenset({"待检验", "已检验", "已驳回", "待审核"})


def can_conduct_quality_inspection(status: Any, inspection_result: Any = None) -> bool:
    """检验录入/改单：未审核前可执行；撤销审核后 status 回落为已检验，须允许再次录入。"""
    normalized_status = _norm(status)
    if normalized_status == "已审核":
        return False
    if normalized_status in _CONDUCT_ALLOWED_STATUSES:
        return True
    if _norm(inspection_result) == "待检验":
        return True
    return False


def derive_quality_inspection_capabilities(
    inspection: Any,
    *,
    supports_purchase_return: bool = False,
    supports_push_rework: bool = False,
    pushed_purchase_return_quantity: float = 0.0,
    pushed_rework_quantity: float = 0.0,
    certificate_issued: bool = False,
) -> QualityInspectionCapabilities:
    status = _norm(getattr(inspection, "status", None))
    review_status = _norm(getattr(inspection, "review_status", None))
    quality_status = _norm(getattr(inspection, "quality_status", None))
    inspection_result = _norm(getattr(inspection, "inspection_result", None))
    unqualified_qty = float(getattr(inspection, "unqualified_quantity", 0) or 0)

    conduct_allowed = can_conduct_quality_inspection(status, inspection_result)
    conduct_cap = _cap(
        conduct_allowed,
        "quality_inspection.conduct.approved_locked" if not conduct_allowed else None,
    )

    pending_audit = _is_pending_review(review_status) and status in ("已检验", "待审核")
    approve_cap = _cap(
        pending_audit,
        "quality_inspection.approve.not_pending" if not pending_audit else None,
    )
    reject_cap = approve_cap

    revoke_cap = _cap(
        status == "已审核",
        "quality_inspection.revoke_approval.not_approved" if status != "已审核" else None,
    )

    revoke_conduct_allowed = can_revoke_quality_inspection_conduct(status, inspection_result)
    if revoke_conduct_allowed:
        if supports_purchase_return and float(pushed_purchase_return_quantity or 0) > 0:
            revoke_conduct_allowed = False
            revoke_conduct_reason = "quality_inspection.revoke_conduct.has_downstream"
        elif supports_push_rework and float(pushed_rework_quantity or 0) > 0:
            revoke_conduct_allowed = False
            revoke_conduct_reason = "quality_inspection.revoke_conduct.has_downstream"
        elif certificate_issued:
            revoke_conduct_allowed = False
            revoke_conduct_reason = "quality_inspection.revoke_conduct.has_downstream"
        else:
            revoke_conduct_reason = None
    elif status == "已审核":
        revoke_conduct_reason = "quality_inspection.revoke_conduct.need_revoke_approval"
    elif status == "待检验" or inspection_result == "待检验":
        revoke_conduct_reason = "quality_inspection.revoke_conduct.not_conducted"
    else:
        revoke_conduct_reason = "quality_inspection.revoke_conduct.not_allowed"
    revoke_conduct_cap = _cap(revoke_conduct_allowed, revoke_conduct_reason)

    defect_allowed = (
        quality_status == "不合格"
        and unqualified_qty > 0
        and status == "已检验"
    )
    create_defect_cap = _cap(
        defect_allowed,
        "quality_inspection.create_defect.not_allowed" if not defect_allowed else None,
    )

    push_return_cap = _cap(False, "quality_inspection.push_purchase_return.not_allowed")
    if supports_purchase_return:
        pushed_return_qty = max(0.0, float(pushed_purchase_return_quantity or 0))
        max_push_return = max(0.0, unqualified_qty - pushed_return_qty)
        if defect_allowed and max_push_return > 0:
            push_return_cap = _cap(True)
        elif defect_allowed and max_push_return <= 0:
            push_return_cap = _cap(False, "quality_inspection.push_purchase_return.already_pushed")
        elif unqualified_qty <= 0:
            push_return_cap = _cap(False, "quality_inspection.push_purchase_return.not_allowed")
        else:
            push_return_cap = _cap(False, "quality_inspection.push_purchase_return.not_allowed")

    update_cap = _cap(
        conduct_allowed,
        "quality_inspection.update.not_editable" if not conduct_allowed else None,
    )

    delete_allowed = status == "待检验" or inspection_result == "待检验"
    delete_cap = _cap(
        delete_allowed,
        "quality_inspection.delete.not_pending" if not delete_allowed else None,
    )

    print_cap = _cap(True)

    push_rework_cap = _cap(False, "finished_goods_inspection.push_rework.not_allowed")
    if supports_push_rework:
        pushed_qty = max(0.0, float(pushed_rework_quantity or 0))
        max_push = max(0.0, unqualified_qty - pushed_qty)
        if defect_allowed and max_push > 0:
            push_rework_cap = _cap(True)
        elif defect_allowed and max_push <= 0:
            push_rework_cap = _cap(False, "finished_goods_inspection.push_rework.already_pushed")
        elif unqualified_qty <= 0:
            push_rework_cap = _cap(False, "finished_goods_inspection.push_rework.no_unqualified")
        else:
            push_rework_cap = _cap(False, "finished_goods_inspection.push_rework.not_allowed")

    return QualityInspectionCapabilities(
        conduct=conduct_cap,
        approve=approve_cap,
        reject=reject_cap,
        revoke_approval=revoke_cap,
        revoke_conduct=revoke_conduct_cap,
        create_defect=create_defect_cap,
        push_purchase_return=push_return_cap,
        push_rework=push_rework_cap,
        update=update_cap,
        delete=delete_cap,
        print=print_cap,
    )


def assert_quality_inspection_capability(
    inspection: Any,
    action: str,
    *,
    supports_purchase_return: bool = False,
    supports_push_rework: bool = False,
    pushed_purchase_return_quantity: float = 0.0,
    pushed_rework_quantity: float = 0.0,
    certificate_issued: bool = False,
) -> None:
    caps = derive_quality_inspection_capabilities(
        inspection,
        supports_purchase_return=supports_purchase_return,
        supports_push_rework=supports_push_rework,
        pushed_purchase_return_quantity=pushed_purchase_return_quantity,
        pushed_rework_quantity=pushed_rework_quantity,
        certificate_issued=certificate_issued,
    )
    cap_map = {
        "conduct": caps.conduct,
        "approve": caps.approve,
        "reject": caps.reject,
        "revoke_approval": caps.revoke_approval,
        "revoke_conduct": caps.revoke_conduct,
        "create_defect": caps.create_defect,
        "push_purchase_return": caps.push_purchase_return,
        "push_rework": caps.push_rework,
        "update": caps.update,
        "delete": caps.delete,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown quality inspection capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
