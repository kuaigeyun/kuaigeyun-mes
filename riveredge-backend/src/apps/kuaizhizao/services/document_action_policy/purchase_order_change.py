"""采购变更单业务态 capabilities（与 sales_order_change 对称）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, is_draft_status, normalize_status
from apps.kuaizhizao.constants.order_change import OrderChangeApplyStatus, OrderChangeLineType
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PurchaseOrderChangeCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_pending_review(status: Any) -> bool:
    raw = _norm_status(status)
    return normalize_status(raw) == DocumentStatus.PENDING_REVIEW.value or raw in ("待审核", "PENDING")


def _is_applied(doc: Any) -> bool:
    if getattr(doc, "applied_at", None):
        return True
    st = _norm_status(getattr(doc, "status", None))
    return st in (OrderChangeApplyStatus.APPLIED.value, "APPLIED", "已生效")


def derive_purchase_order_change_capabilities(
    doc: Any,
    *,
    has_change_content: bool = True,
) -> PurchaseOrderChangeCapabilities:
    status = getattr(doc, "status", None)
    is_draft = is_draft_status(status)
    is_pending = _is_pending_review(status)

    update_cap = _cap(
        is_draft or is_pending,
        "purchase_order_change.update.not_draft" if not (is_draft or is_pending) else None,
    )
    delete_cap = _cap(is_draft, "purchase_order_change.delete.not_draft" if not is_draft else None)

    submit_allowed = is_draft and has_change_content
    submit_reason = (
        "purchase_order_change.submit.not_draft"
        if not is_draft
        else ("purchase_order_change.submit.no_changes" if is_draft and not has_change_content else None)
    )
    submit_cap = _cap(submit_allowed, submit_reason)

    withdraw_cap = _cap(
        is_pending,
        "purchase_order_change.withdraw_submit.not_pending" if not is_pending else None,
    )

    approve_cap = _cap(
        is_pending,
        "purchase_order_change.approve.not_pending" if not is_pending else None,
    )

    apply_allowed = not _is_applied(doc) and (
        normalize_status(_norm_status(status)) == DocumentStatus.AUDITED.value
        or _norm_status(getattr(doc, "review_status", None)) == ReviewStatus.APPROVED.value
    )
    apply_cap = _cap(
        apply_allowed,
        "purchase_order_change.apply.not_audited" if not apply_allowed else None,
    )

    return PurchaseOrderChangeCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        apply=apply_cap,
        preview_impact=_cap(is_draft or is_pending or apply_allowed),
        print=_cap(True),
        reopen=_cap(False, "purchase_order_change.reopen.not_supported"),
    )


def assert_purchase_order_change_capability(
    doc: Any,
    action: str,
    *,
    has_change_content: bool = True,
) -> None:
    caps = derive_purchase_order_change_capabilities(doc, has_change_content=has_change_content)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "apply": caps.apply,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown purchase order change capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
