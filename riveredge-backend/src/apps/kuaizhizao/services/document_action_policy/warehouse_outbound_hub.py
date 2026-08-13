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
_DELETABLE_PRE_EFFECTIVE = frozenset({
    "待审核", "草稿", "draft", "已取消", "cancelled",
})
_PENDING_EXECUTION = frozenset({
    "待出库", "待领料", "待借出", "pending",
})
_EDITABLE_PRODUCTION_PICKING = frozenset({
    "草稿", "draft", "待审核", "待领料", "pending",
})
_REVIEW_APPROVED = frozenset({
    "已通过", "审核通过", "approved", "APPROVED", "通过",
})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_review_approved(record: Any) -> bool:
    review = _norm(getattr(record, "review_status", None))
    return review in _REVIEW_APPROVED


def _derive_delete_capability(
    record: Any,
    *,
    status: str,
    is_outsource_issue: bool,
    audit_required: bool,
) -> ActionCapability:
    if is_outsource_issue:
        return _cap(False, "outbound_hub.delete.outsource_issue")
    if status in _DELETABLE_PRE_EFFECTIVE:
        return _cap(True)
    if status in _OUTBOUND_POSTED_STATUSES:
        return _cap(False, "outbound_hub.delete.posted")
    if status in _PENDING_EXECUTION:
        if audit_required and _is_review_approved(record):
            return _cap(False, "outbound_hub.delete.audited")
        return _cap(True)
    return _cap(False, "outbound_hub.delete.not_allowed")


def derive_outbound_hub_capabilities(
    record: Any,
    *,
    outbound_type: Optional[str] = None,
    audit_required: bool = False,
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

    # 生产领料：确认领料前可编辑应领数量/仓库/备注
    if is_outsource_issue:
        update_allowed = False
        update_reason = "outbound_hub.update.outsource_issue"
    elif ot == "production_picking":
        update_allowed = status in _EDITABLE_PRODUCTION_PICKING
        update_reason = None if update_allowed else (
            "outbound_hub.update.posted"
            if status in _OUTBOUND_POSTED_STATUSES
            else "outbound_hub.update.not_allowed"
        )
    else:
        update_allowed = False
        update_reason = "outbound_hub.update.production_picking_only"

    return OutboundHubCapabilities(
        confirm=_cap(confirm_allowed, confirm_reason),
        withdraw=_cap(withdraw_allowed, withdraw_reason),
        print=_cap(True),
        delete=_derive_delete_capability(
            record,
            status=status,
            is_outsource_issue=is_outsource_issue,
            audit_required=audit_required,
        ),
        update=_cap(update_allowed, update_reason),
    )


def assert_outbound_hub_capability(
    record: Any,
    action: str,
    *,
    outbound_type: Optional[str] = None,
    audit_required: bool = False,
) -> None:
    caps = derive_outbound_hub_capabilities(
        record, outbound_type=outbound_type, audit_required=audit_required
    )
    cap_map = {
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "print": caps.print,
        "delete": caps.delete,
        "update": caps.update,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown outbound hub capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)


async def assert_outbound_hub_delete(
    tenant_id: int,
    record: Any,
    outbound_type: str,
) -> None:
    from infra.services.business_config_service import BusinessConfigService

    audit_required = await BusinessConfigService().check_audit_required(tenant_id, outbound_type)
    assert_outbound_hub_capability(
        record,
        "delete",
        outbound_type=outbound_type,
        audit_required=audit_required,
    )
