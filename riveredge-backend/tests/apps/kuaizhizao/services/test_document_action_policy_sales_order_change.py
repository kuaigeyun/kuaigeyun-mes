"""销售变更单 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.sales_order_change import (
    assert_sales_order_change_capability,
    derive_sales_order_change_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _doc(**kwargs):
    defaults = {
        "status": "DRAFT",
        "review_status": "PENDING",
        "delta_amount": 10,
        "header_changes": None,
        "applied_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_draft_update_delete_submit():
    caps = derive_sales_order_change_capabilities(_doc(), has_change_content=True)
    assert caps.update.allowed
    assert caps.delete.allowed
    assert caps.submit.allowed


def test_submit_requires_change_content():
    caps = derive_sales_order_change_capabilities(_doc(delta_amount=0), has_change_content=False)
    assert not caps.submit.allowed
    assert caps.submit.reason == "sales_order_change.submit.no_changes"


def test_pending_withdraw():
    caps = derive_sales_order_change_capabilities(_doc(status="PENDING_REVIEW"))
    assert caps.withdraw_submit.allowed
    assert not caps.delete.allowed


def test_audited_apply():
    caps = derive_sales_order_change_capabilities(
        _doc(status="AUDITED", review_status="APPROVED"),
    )
    assert caps.apply.allowed


def test_assert_delete_non_draft_raises():
    with pytest.raises(BusinessLogicError):
        assert_sales_order_change_capability(_doc(status="PENDING_REVIEW"), "delete")
