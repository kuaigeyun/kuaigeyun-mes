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
    "待入库", "草稿", "待退货", "待退料", "待收货", "pending", "draft", "待归还", "待确认",
})
_OUTSOURCE_PREVIEW_ONLY = frozenset({
    "outsource_material_return",
    "outsource_product_return",
})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


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

    return InboundHubCapabilities(
        confirm=_cap(confirm_allowed, confirm_reason),
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
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown inbound hub capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
