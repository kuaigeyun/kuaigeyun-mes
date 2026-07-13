"""统一需求（需求计划）业务态 capabilities。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import (
    DemandStatus,
    LEGACY_AUDITED_VALUES,
    ReviewStatus,
    normalize_status,
)
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


def demand_allows_computation_merge(demand: Any) -> bool:
    """与需求下推需求计算门禁一致：审核通过且处于可计算状态（已审核/已确认/已生效等）。"""
    review_norm = _norm_review_status(getattr(demand, "review_status", None))
    if review_norm != ReviewStatus.APPROVED.value:
        return False
    raw = str(getattr(demand, "status", "") or "").strip()
    if raw in LEGACY_AUDITED_VALUES:
        return True
    status_norm = normalize_status(raw)
    return status_norm in (
        DemandStatus.AUDITED.value,
        DemandStatus.CONFIRMED.value,
        "EFFECTIVE",
    )


def _is_audited_for_computation(demand: Any) -> bool:
    return demand_allows_computation_merge(demand)


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
