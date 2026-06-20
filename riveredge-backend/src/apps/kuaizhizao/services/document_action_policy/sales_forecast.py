"""销售预测业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import (
    DocumentStatus,
    LEGACY_AUDITED_VALUES,
    LEGACY_PENDING_VALUES,
    ReviewStatus,
    is_draft_status,
    is_pending_review_status,
    normalize_status,
)
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    SalesForecastCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _normalize_review_status(review_status: Any) -> str:
    from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES

    raw = _norm_status(review_status)
    if not raw:
        return ""
    return REVIEW_STATUS_ALIASES.get(raw, raw.upper())


def _is_review_approved(review_status: Any) -> bool:
    return _normalize_review_status(review_status) == ReviewStatus.APPROVED.value


def _is_review_pending(review_status: Any) -> bool:
    rs = _normalize_review_status(review_status)
    return rs in LEGACY_PENDING_VALUES or rs == ReviewStatus.PENDING.value or rs == ""


def _is_rejected_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.REJECTED.value or raw in ("已驳回", "REJECTED", "审核驳回")


def _is_cancelled_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.CANCELLED.value or raw in ("已取消", "CANCELLED")


def _is_completed_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.COMPLETED.value or raw in ("已完成", "COMPLETED")


def _is_audited_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized in (DocumentStatus.AUDITED.value, DocumentStatus.CONFIRMED.value) or raw in LEGACY_AUDITED_VALUES


def derive_sales_forecast_capabilities(
    forecast: Any,
    *,
    pushed_to_computation: bool = False,
    has_downstream: bool = False,
    has_items: bool = True,
) -> SalesForecastCapabilities:
    status = getattr(forecast, "status", None)
    review_status = getattr(forecast, "review_status", None)

    update_allowed = (
        is_draft_status(status or "")
        or is_pending_review_status(status or "")
        or _is_rejected_status(status)
    )
    update_cap = _cap(
        update_allowed,
        "sales_forecast.update.not_allowed" if not update_allowed else None,
    )

    delete_allowed = is_draft_status(status or "") or is_pending_review_status(status or "")
    delete_cap = _cap(
        delete_allowed,
        "sales_forecast.delete.not_allowed" if not delete_allowed else None,
    )

    submit_allowed = is_draft_status(status or "")
    submit_cap = _cap(
        submit_allowed,
        "sales_forecast.submit.not_draft" if not submit_allowed else None,
    )

    withdraw_allowed = is_pending_review_status(status or "") and _is_review_pending(review_status)
    withdraw_cap = _cap(
        withdraw_allowed,
        "sales_forecast.withdraw_submit.not_pending" if not withdraw_allowed else None,
    )

    approve_allowed = is_pending_review_status(status or "")
    approve_cap = _cap(
        approve_allowed,
        "sales_forecast.approve.not_pending" if not approve_allowed else None,
    )
    reject_cap = approve_cap

    revoke_allowed = False
    revoke_reason = "sales_forecast.revoke_approval.not_audited"
    if not _is_audited_status(status):
        revoke_reason = "sales_forecast.revoke_approval.not_audited"
    elif not _is_review_approved(review_status):
        revoke_reason = "sales_forecast.revoke_approval.not_approved"
    elif has_downstream:
        revoke_reason = "sales_forecast.revoke_approval.has_downstream"
    else:
        revoke_allowed = True
        revoke_reason = None
    revoke_cap = _cap(revoke_allowed, revoke_reason)

    print_cap = _cap(True)

    push_allowed = False
    push_reason = "sales_forecast.push.not_approved"
    if pushed_to_computation:
        push_reason = "sales_forecast.push.already_pushed"
    elif is_draft_status(status or "") or is_pending_review_status(status or ""):
        push_reason = "sales_forecast.push.not_approved"
    elif _is_rejected_status(status):
        push_reason = "sales_forecast.push.rejected"
    elif _is_cancelled_status(status):
        push_reason = "sales_forecast.push.cancelled"
    elif _is_completed_status(status):
        push_reason = "sales_forecast.push.completed"
    elif not _is_review_approved(review_status) or not _is_audited_status(status):
        push_reason = "sales_forecast.push.not_approved"
    elif not has_items:
        push_reason = "sales_forecast.push.no_items"
    else:
        push_allowed = True
        push_reason = None
    push_cap = _cap(push_allowed, push_reason)

    return SalesForecastCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        reject=reject_cap,
        revoke_approval=revoke_cap,
        print=print_cap,
        push_computation=push_cap,
    )


def assert_sales_forecast_capability(
    forecast: Any,
    action: str,
    *,
    pushed_to_computation: bool = False,
    has_downstream: bool = False,
    has_items: bool = True,
) -> None:
    caps = derive_sales_forecast_capabilities(
        forecast,
        pushed_to_computation=pushed_to_computation,
        has_downstream=has_downstream,
        has_items=has_items,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "reject": caps.reject,
        "revoke_approval": caps.revoke_approval,
        "print": caps.print,
        "push_computation": caps.push_computation,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown sales forecast capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
