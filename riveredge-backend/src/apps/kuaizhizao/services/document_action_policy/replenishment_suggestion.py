"""补货建议业务态 capabilities（与 replenishment_suggestion_service 门禁一致）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ReplenishmentSuggestionCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _qty_positive(suggestion: Any) -> bool:
    try:
        return Decimal(str(getattr(suggestion, "suggested_quantity", 0) or 0)) > 0
    except Exception:
        return False


def derive_replenishment_suggestion_capabilities(
    suggestion: Any,
    *,
    require_purchase_requisition: bool = False,
) -> ReplenishmentSuggestionCapabilities:
    status = _norm(getattr(suggestion, "status", None))
    pending = status == "pending"
    qty_ok = _qty_positive(suggestion)
    deny_not_pending = "replenishment_suggestion.process.not_pending" if not pending else None
    deny_push = None
    if not pending:
        deny_push = "replenishment_suggestion.push.not_pending"
    elif not qty_ok:
        deny_push = "replenishment_suggestion.push.no_quantity"

    push_pr = _cap(pending and qty_ok, deny_push or deny_not_pending)
    if require_purchase_requisition:
        push_po = _cap(False, "replenishment_suggestion.push_purchase_order.require_requisition")
    else:
        push_po = _cap(pending and qty_ok, deny_push or deny_not_pending)

    return ReplenishmentSuggestionCapabilities(
        process=_cap(pending, deny_not_pending),
        ignore=_cap(pending, deny_not_pending),
        push_purchase_requisition=push_pr,
        push_purchase_order=push_po,
        print=_cap(True),
    )


def assert_replenishment_suggestion_capability(
    suggestion: Any,
    action: str,
    *,
    require_purchase_requisition: bool = False,
) -> None:
    caps = derive_replenishment_suggestion_capabilities(
        suggestion,
        require_purchase_requisition=require_purchase_requisition,
    )
    cap_map = {
        "process": caps.process,
        "ignore": caps.ignore,
        "push_purchase_requisition": caps.push_purchase_requisition,
        "push_purchase_order": caps.push_purchase_order,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown replenishment suggestion capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
