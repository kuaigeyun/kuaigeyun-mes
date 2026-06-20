"""库存预警记录业务态 capabilities（与 inventory_alert_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    InventoryAlertCapabilities,
)

_HANDLEABLE_STATUSES = frozenset({"pending", "processing"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_inventory_alert_capabilities(alert: Any) -> InventoryAlertCapabilities:
    status = _norm(getattr(alert, "status", None))
    handleable = status in _HANDLEABLE_STATUSES
    deny_reason = "inventory_alert.handle.already_handled" if not handleable else None

    return InventoryAlertCapabilities(
        resolve=_cap(handleable, deny_reason),
        ignore=_cap(handleable, deny_reason),
        print=_cap(True),
    )


def assert_inventory_alert_capability(alert: Any, action: str) -> None:
    caps = derive_inventory_alert_capabilities(alert)
    cap_map = {
        "resolve": caps.resolve,
        "ignore": caps.ignore,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown inventory alert capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
