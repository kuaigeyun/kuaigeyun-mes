"""统一需求 document_action_policy 单元测试。"""

from types import SimpleNamespace

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
from apps.kuaizhizao.services.document_action_policy.demand import (
    demand_allows_computation_merge,
    derive_demand_capabilities,
)


def _demand(status: str, review_status: str = ReviewStatus.APPROVED.value):
    return SimpleNamespace(status=status, review_status=review_status)


def test_merge_computation_allows_confirmed_and_effective():
    assert demand_allows_computation_merge(_demand(DemandStatus.CONFIRMED.value))
    assert demand_allows_computation_merge(_demand("已确认"))
    assert demand_allows_computation_merge(_demand("已生效"))
    assert demand_allows_computation_merge(_demand(DemandStatus.AUDITED.value))


def test_merge_computation_rejects_draft_or_pending_review():
    assert not demand_allows_computation_merge(_demand(DemandStatus.DRAFT.value))
    assert not demand_allows_computation_merge(
        _demand(DemandStatus.AUDITED.value, ReviewStatus.PENDING.value)
    )


def test_derive_capabilities_exposes_merge_for_confirmed():
    caps = derive_demand_capabilities(_demand(DemandStatus.CONFIRMED.value))
    assert caps.merge_computation.allowed is True
