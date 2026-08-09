"""出库 Hub 聚合行业务态 capabilities（与 outboundHubTypes / outboundBatchConfirm 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    OutboundHubCapabilities,
)

_OUTBOUND_PENDING_STATUSES = frozenset({
    "待出库", "待领料", "待借出", "草稿", "draft", "pending",
})
_OUTBOUND_POSTED_STATUSES = frozenset({
    "已出库", "已领料", "已借出", "已完成", "completed", "已确认", "confirmed",
})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_outbound_hub_capabilities(
    record: Any,
    *,
    outbound_type: Optional[str] = None,
) -> OutboundHubCapabilities:
    ot = _norm(outbound_type or getattr(record, "outbound_type", None))
    status = _norm(getattr(record, "status", None))
    is_outsource_issue = ot == "outsource_issue"

    # 生产领料：仅「待领料」可确认（待审核/草稿须先走 UniAudit）
    if ot == "production_picking":
        confirm_allowed = status == "待领料"
        confirm_reason = None
        if status == "待审核":
            confirm_reason = "outbound_hub.confirm.pending_audit"
        elif not confirm_allowed:
            confirm_reason = "outbound_hub.confirm.not_pending"
    # 销售出库：仅「待出库」可确认（开启审核时须先通过 UniAudit）
    elif ot == "sales_delivery":
        confirm_allowed = status == "待出库"
        confirm_reason = None
        if status == "待审核":
            confirm_reason = "outbound_hub.confirm.pending_audit"
        elif not confirm_allowed:
            confirm_reason = "outbound_hub.confirm.not_pending"
    else:
        confirm_allowed = not is_outsource_issue and status in _OUTBOUND_PENDING_STATUSES
        confirm_reason = None
        if is_outsource_issue:
            confirm_reason = "outbound_hub.confirm.outsource_issue"
        elif not confirm_allowed:
            confirm_reason = "outbound_hub.confirm.not_pending"

    withdraw_allowed = not is_outsource_issue and status in _OUTBOUND_POSTED_STATUSES
    withdraw_reason = None
    if is_outsource_issue:
        withdraw_reason = "outbound_hub.withdraw.outsource_issue"
    elif not withdraw_allowed:
        withdraw_reason = "outbound_hub.withdraw.not_posted"

    return OutboundHubCapabilities(
        confirm=_cap(confirm_allowed, confirm_reason),
        withdraw=_cap(withdraw_allowed, withdraw_reason),
        print=_cap(True),
    )


def assert_outbound_hub_capability(
    record: Any,
    action: str,
    *,
    outbound_type: Optional[str] = None,
) -> None:
    caps = derive_outbound_hub_capabilities(record, outbound_type=outbound_type)
    cap_map = {
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown outbound hub capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
