"""销售预测 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.sales_forecast import (
    assert_sales_forecast_capability,
    derive_sales_forecast_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _f(**kwargs):
    defaults = {
        "status": "DRAFT",
        "review_status": "PENDING",
        "planning_pushed_to_computation": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_draft_update_delete_submit():
    caps = derive_sales_forecast_capabilities(_f())
    assert caps.update.allowed
    assert caps.delete.allowed
    assert caps.submit.allowed
    assert not caps.push_computation.allowed


def test_pending_withdraw_delete():
    caps = derive_sales_forecast_capabilities(_f(status="PENDING_REVIEW"))
    assert caps.withdraw_submit.allowed
    assert caps.delete.allowed
    assert not caps.submit.allowed


def test_audited_push():
    caps = derive_sales_forecast_capabilities(
        _f(status="AUDITED", review_status="APPROVED"),
        has_items=True,
    )
    assert caps.push_computation.allowed
    assert not caps.update.allowed


def test_push_blocked_when_pushed():
    caps = derive_sales_forecast_capabilities(
        _f(status="AUDITED", review_status="APPROVED", planning_pushed_to_computation=True),
        pushed_to_computation=True,
        has_items=True,
    )
    assert not caps.push_computation.allowed
    assert caps.push_computation.reason == "sales_forecast.push.already_pushed"


def test_revoke_blocked_with_downstream():
    caps = derive_sales_forecast_capabilities(
        _f(status="AUDITED", review_status="APPROVED"),
        has_downstream=True,
    )
    assert not caps.revoke_approval.allowed


def test_assert_delete_audited_raises():
    with pytest.raises(BusinessLogicError):
        assert_sales_forecast_capability(_f(status="AUDITED", review_status="APPROVED"), "delete")
