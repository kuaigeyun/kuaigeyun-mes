"""销售订单 document_action_policy 单元测试。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.sales_order import (
    assert_sales_order_capability,
    derive_sales_order_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _o(**kwargs):
    defaults = {
        "status": "草稿",
        "review_status": "待审核",
        "planning_pushed_to_computation": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_draft_update_delete_submit():
    caps = derive_sales_order_capabilities(_o())
    assert caps.update.allowed
    assert caps.delete.allowed
    assert caps.submit.allowed
    assert not caps.push_computation.allowed


def test_audited_push_computation_allowed():
    caps = derive_sales_order_capabilities(
        _o(status="已审核", review_status="审核通过"),
        has_items=True,
    )
    assert caps.push_computation.allowed
    assert caps.push_work_order.allowed
    assert not caps.update.allowed


def test_computation_already_pushed_blocks_push():
    caps = derive_sales_order_capabilities(
        _o(status="已审核", review_status="审核通过"),
        pushed_to_computation=True,
        has_items=True,
    )
    assert not caps.push_computation.allowed
    assert caps.withdraw_computation.allowed
    assert caps.withdraw_computation.reason == "sales_order.push_computation.already_pushed"


def test_line_work_orders_block_computation_push():
    caps = derive_sales_order_capabilities(
        _o(status="已审核", review_status="审核通过"),
        has_items=True,
        has_line_work_orders=True,
    )
    assert not caps.push_computation.allowed
    assert caps.push_computation.reason == "sales_order.push_computation.line_work_orders"


def test_withdraw_submit_pending_review():
    caps = derive_sales_order_capabilities(_o(status="待审核", review_status="待审核"))
    assert caps.withdraw_submit.allowed


def test_withdraw_submit_blocked_when_computation_pushed():
    caps = derive_sales_order_capabilities(
        _o(status="待审核", review_status="待审核"),
        computation_pushed_blocks_withdraw=True,
    )
    assert not caps.withdraw_submit.allowed


def test_approve_pending_review():
    caps = derive_sales_order_capabilities(_o(status="待审核", review_status="待审核"))
    assert caps.approve.allowed


def test_revoke_approval_strictly_audited():
    caps = derive_sales_order_capabilities(_o(status="已审核", review_status="审核通过"))
    assert caps.revoke_approval.allowed


def test_create_change_order_when_locked():
    caps = derive_sales_order_capabilities(
        _o(status="已审核", review_status="审核通过"),
        has_items=True,
    )
    assert caps.create_change_order.allowed
    assert not caps.update.allowed


def test_assert_raises_on_delete_audited():
    with pytest.raises(BusinessLogicError):
        assert_sales_order_capability(_o(status="已审核", review_status="审核通过"), "delete")
