"""销售变更单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, is_draft_status, normalize_status
from apps.kuaizhizao.constants.order_change import OrderChangeApplyStatus, OrderChangeLineType
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    SalesOrderChangeCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_pending_review(status: Any) -> bool:
    raw = _norm_status(status)
    return normalize_status(raw) == DocumentStatus.PENDING_REVIEW.value or raw in ("待审核", "PENDING")


def _is_rejected(status: Any) -> bool:
    raw = _norm_status(status)
    return normalize_status(raw) == DocumentStatus.REJECTED.value or raw in ("已驳回", "REJECTED")


def _is_applied(doc: Any) -> bool:
    if getattr(doc, "applied_at", None):
        return True
    st = _norm_status(getattr(doc, "status", None))
    return st in (OrderChangeApplyStatus.APPLIED.value, "APPLIED", "已生效")


def _is_audited_pending_apply(doc: Any) -> bool:
    st = normalize_status(_norm_status(getattr(doc, "status", None)))
    rs = _norm_status(getattr(doc, "review_status", None))
    if _is_applied(doc):
        return False
    if st == DocumentStatus.AUDITED.value or rs == ReviewStatus.APPROVED.value:
        return True
    return False


def _compute_has_change_content(doc: Any, items: Optional[list[Any]] = None) -> bool:
    delta = Decimal(str(getattr(doc, "delta_amount", 0) or 0))
    if delta != 0:
        return True
    header = getattr(doc, "header_changes", None)
    if header:
        return True
    if items:
        for i in items:
            ct = _norm_status(getattr(i, "change_type", None))
            if ct in (OrderChangeLineType.LINE_ADD.value, OrderChangeLineType.LINE_CANCEL.value):
                return True
            if Decimal(str(getattr(i, "delta_amount", 0) or 0)) != 0:
                return True
    return False


def derive_sales_order_change_capabilities(
    doc: Any,
    *,
    has_change_content: bool = True,
) -> SalesOrderChangeCapabilities:
    status = getattr(doc, "status", None)
    is_draft = is_draft_status(status)
    is_pending = _is_pending_review(status)
    is_rejected = _is_rejected(status)
    applied = _is_applied(doc)

    update_allowed = is_draft or is_pending
    update_cap = _cap(
        update_allowed,
        "sales_order_change.update.not_draft" if not update_allowed else None,
    )

    delete_cap = _cap(
        is_draft,
        "sales_order_change.delete.not_draft" if not is_draft else None,
    )

    submit_allowed = is_draft and has_change_content
    submit_reason = "sales_order_change.submit.not_draft" if not is_draft else (
        "sales_order_change.submit.no_changes" if is_draft and not has_change_content else None
    )
    submit_cap = _cap(submit_allowed, submit_reason)

    withdraw_cap = _cap(
        is_pending,
        "sales_order_change.withdraw_submit.not_pending" if not is_pending else None,
    )

    approve_cap = _cap(
        is_pending,
        "sales_order_change.approve.not_pending" if not is_pending else None,
    )

    apply_allowed = _is_audited_pending_apply(doc)
    apply_cap = _cap(
        apply_allowed,
        "sales_order_change.apply.not_audited" if not apply_allowed else None,
    )

    preview_cap = _cap(is_draft or is_pending or _is_audited_pending_apply(doc))

    print_cap = _cap(True)

    reopen_allowed = is_rejected
    reopen_cap = _cap(
        reopen_allowed,
        "sales_order_change.reopen.not_rejected" if not reopen_allowed else None,
    )

    return SalesOrderChangeCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        apply=apply_cap,
        preview_impact=preview_cap,
        print=print_cap,
        reopen=reopen_cap,
    )


def assert_sales_order_change_capability(
    doc: Any,
    action: str,
    *,
    has_change_content: bool = True,
) -> None:
    caps = derive_sales_order_change_capabilities(doc, has_change_content=has_change_content)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "apply": caps.apply,
        "preview_impact": caps.preview_impact,
        "print": caps.print,
        "reopen": caps.reopen,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown sales order change capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
