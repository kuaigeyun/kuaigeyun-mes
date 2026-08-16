"""计划建需求计算下推/取单端到端（内存桩）。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.demand import (
    demand_allows_computation_merge,
    derive_demand_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_order import (
    derive_sales_order_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _demand(*, status: str = "AUDITED", review_status: str = "APPROVED", pushed: bool = False):
    return SimpleNamespace(
        status=status,
        review_status=review_status,
        pushed_to_computation=pushed,
    )


def _sales_order(*, status: str = "已审核", review_status: str = "APPROVED", pushed: bool = False):
    return SimpleNamespace(status=status, review_status=review_status)


def test_confirmed_demand_allows_computation_merge():
    demand = _demand(status="CONFIRMED", review_status="APPROVED")
    assert demand_allows_computation_merge(demand) is True


def test_pushed_demand_capability_blocks_merge():
    caps = derive_demand_capabilities(_demand(pushed=True))
    assert caps.merge_computation.allowed is False
    assert caps.merge_computation.reason == "demand.push_computation.already_pushed"


def test_computation_pushed_blocks_direct_work_order():
    caps = derive_sales_order_capabilities(
        _sales_order(),
        pushed_to_computation=True,
        has_items=True,
    )
    assert caps.push_work_order.allowed is False
    assert caps.push_work_order.reason == "sales_order.push_work_order.computation_pushed"


def test_line_work_orders_block_computation_push():
    caps = derive_sales_order_capabilities(
        _sales_order(),
        has_items=True,
        has_line_work_orders=True,
    )
    assert caps.push_computation.allowed is False
    assert caps.push_computation.reason == "sales_order.push_computation.line_work_orders"


def test_confirmed_demand_passes_merge_capability_assert():
    from apps.kuaizhizao.services.document_action_policy.demand import assert_demand_capability

    demand = _demand(status="CONFIRMED", review_status="APPROVED", pushed=False)
    assert_demand_capability(demand, "merge_computation")


def test_draft_demand_fails_merge_capability_assert():
    from apps.kuaizhizao.services.document_action_policy.demand import assert_demand_capability

    demand = _demand(status="DRAFT", review_status="APPROVED", pushed=False)
    with pytest.raises(BusinessLogicError):
        assert_demand_capability(demand, "merge_computation")
