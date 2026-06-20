"""统一需求（需求计划）业务态 capabilities。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, normalize_status
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    DemandCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_review_status(review_status: Any) -> str:
    from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES

    raw = str(review_status or "").strip()
    if not raw:
        return ""
    return REVIEW_STATUS_ALIASES.get(raw, raw.upper())


def _is_audited_for_computation(demand: Any) -> bool:
    status_norm = normalize_status(str(getattr(demand, "status", "") or ""))
    review_norm = _norm_review_status(getattr(demand, "review_status", None))
    return status_norm == DemandStatus.AUDITED.value and review_norm == ReviewStatus.APPROVED.value


def derive_demand_capabilities(demand: Any) -> DemandCapabilities:
    merge_allowed = _is_audited_for_computation(demand)
    merge_cap = _cap(
        merge_allowed,
        "demand.merge_computation.not_audited" if not merge_allowed else None,
    )
    return DemandCapabilities(merge_computation=merge_cap)


def assert_demand_capability(demand: Any, action: str) -> None:
    caps = derive_demand_capabilities(demand)
    cap_map = {
        "merge_computation": caps.merge_computation,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown demand capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
