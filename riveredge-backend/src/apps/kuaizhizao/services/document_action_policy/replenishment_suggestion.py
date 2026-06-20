"""补货建议业务态 capabilities（与 replenishment_suggestion_service 门禁一致）。"""

from __future__ import annotations

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


def derive_replenishment_suggestion_capabilities(suggestion: Any) -> ReplenishmentSuggestionCapabilities:
    status = _norm(getattr(suggestion, "status", None))
    pending = status == "pending"
    deny_reason = "replenishment_suggestion.process.not_pending" if not pending else None

    return ReplenishmentSuggestionCapabilities(
        process=_cap(pending, deny_reason),
        ignore=_cap(pending, deny_reason),
        print=_cap(True),
    )


def assert_replenishment_suggestion_capability(suggestion: Any, action: str) -> None:
    caps = derive_replenishment_suggestion_capabilities(suggestion)
    cap_map = {
        "process": caps.process,
        "ignore": caps.ignore,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown replenishment suggestion capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
