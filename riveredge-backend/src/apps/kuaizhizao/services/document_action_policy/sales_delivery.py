"""销售出库单 — 送货单上拉 capabilities（唯一真源）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    SalesDeliveryPullCapabilities,
)

_CANCELLED = frozenset({"已取消", "cancelled", "CANCELLED"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def derive_sales_delivery_pull_capabilities(
    delivery: Any,
    *,
    has_delivery_notice: bool = False,
    has_noticeable_lines: bool = False,
) -> SalesDeliveryPullCapabilities:
    status = str(getattr(delivery, "status", None) or "").strip()
    customer_id = getattr(delivery, "customer_id", None)

    push_allowed = False
    push_reason = "sales_delivery.push_delivery_notice.not_allowed"
    if status in _CANCELLED:
        push_reason = "sales_delivery.push_delivery_notice.cancelled"
    elif not customer_id:
        push_reason = "sales_delivery.push_delivery_notice.no_customer"
    elif has_delivery_notice:
        push_reason = "sales_delivery.push_delivery_notice.already_created"
    elif not has_noticeable_lines:
        push_reason = "sales_delivery.push_delivery_notice.no_lines"
    else:
        push_allowed = True
        push_reason = None

    return SalesDeliveryPullCapabilities(
        push_delivery_notice=_cap(push_allowed, push_reason),
    )


def assert_sales_delivery_pull_capability(
    delivery: Any,
    action: str,
    *,
    has_delivery_notice: bool = False,
    has_noticeable_lines: bool = False,
) -> None:
    caps = derive_sales_delivery_pull_capabilities(
        delivery,
        has_delivery_notice=has_delivery_notice,
        has_noticeable_lines=has_noticeable_lines,
    )
    cap_map = {
        "push_delivery_notice": caps.push_delivery_notice,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown sales delivery pull capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
