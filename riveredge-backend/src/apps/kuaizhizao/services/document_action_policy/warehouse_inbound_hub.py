"""入库 Hub 聚合行业务态 capabilities（与 inboundHubTypes / inboundBatchConfirm 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    InboundHubCapabilities,
)

_INBOUND_PENDING_STATUSES = frozenset({
    "待入库", "草稿", "待退货", "待退料", "待收货", "pending", "draft", "待归还", "待确认", "DRAFT",
})
_INBOUND_POSTED_STATUSES = frozenset({
    "已入库", "已退货", "已退料", "已归还", "已完成", "已确认", "completed", "processed", "已入库",
})
_OUTSOURCE_PREVIEW_ONLY = frozenset({
    "outsource_material_return",
    "outsource_product_return",
})
_EDITABLE_RECEIPT_TYPES = frozenset({
    "purchase",
    "finished_goods",
    "semi_finished_goods",
    "production_return",
    "other_inbound",
    "material_return",
    "sales_return",
})
_WITHDRAWABLE_RECEIPT_TYPES = frozenset({
    "purchase",
    "finished_goods",
    "semi_finished_goods",
    "production_return",
    "customer_material",
    "sales_return",
    "material_return",
    "other_inbound",
})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_posted(receipt_type: str, status: str) -> bool:
    if receipt_type == "production_return":
        return status == "已退料"
    if receipt_type == "customer_material":
        return status in {"processed", "已入库"}
    if receipt_type == "sales_return":
        return status == "已退货" or status.lower() == "completed"
    if receipt_type == "material_return":
        return status == "已归还" or status.lower() == "completed"
    return status in _INBOUND_POSTED_STATUSES or status.lower() == "completed"


def derive_inbound_hub_capabilities(
    record: Any,
    *,
    receipt_type: Optional[str] = None,
) -> InboundHubCapabilities:
    rt = _norm(receipt_type or getattr(record, "receipt_type", None))
    status = _norm(getattr(record, "status", None))

    confirm_allowed = False
    confirm_reason = "inbound_hub.confirm.not_pending"
    if rt in _OUTSOURCE_PREVIEW_ONLY:
        confirm_reason = "inbound_hub.confirm.use_single_preview"
    elif rt == "customer_material":
        if status == "pending":
            confirm_allowed = True
            confirm_reason = None
        else:
            confirm_reason = "customer_material.confirm.not_pending"
    elif status in _INBOUND_PENDING_STATUSES:
        confirm_allowed = True
        confirm_reason = None

    posted = _is_posted(rt, status)
    if rt in _WITHDRAWABLE_RECEIPT_TYPES and posted:
        withdraw_allowed = True
        withdraw_reason = None
    elif rt in _OUTSOURCE_PREVIEW_ONLY:
        withdraw_allowed = False
        withdraw_reason = "inbound_hub.withdraw.unsupported_type"
    elif not posted:
        withdraw_allowed = False
        withdraw_reason = "inbound_hub.withdraw.not_posted"
    else:
        withdraw_allowed = False
        withdraw_reason = "inbound_hub.withdraw.unsupported_type"

    if rt in _EDITABLE_RECEIPT_TYPES and status in _INBOUND_PENDING_STATUSES:
        update_allowed = True
        update_reason = None
    elif rt in _OUTSOURCE_PREVIEW_ONLY:
        update_allowed = False
        update_reason = "inbound_hub.update.unsupported_type"
    elif posted:
        update_allowed = False
        update_reason = "inbound_hub.update.posted"
    else:
        update_allowed = False
        update_reason = "inbound_hub.update.not_allowed"

    return InboundHubCapabilities(
        confirm=_cap(confirm_allowed, confirm_reason),
        withdraw=_cap(withdraw_allowed, withdraw_reason),
        update=_cap(update_allowed, update_reason),
        print=_cap(True),
    )


def assert_inbound_hub_capability(
    record: Any,
    action: str,
    *,
    receipt_type: Optional[str] = None,
) -> None:
    caps = derive_inbound_hub_capabilities(record, receipt_type=receipt_type)
    cap_map = {
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "update": caps.update,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown inbound hub capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
