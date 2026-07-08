"""销售退货单 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.sales_return import (
    assert_sales_return_capability,
    derive_sales_return_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _r(**kwargs):
    defaults = {"status": "待退货"}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_pending_update_delete_confirm():
    caps = derive_sales_return_capabilities(_r(), has_items=True)
    assert caps.update.allowed
    assert caps.delete.allowed
    assert caps.confirm.allowed
    assert not caps.withdraw.allowed


def test_draft_update_only():
    caps = derive_sales_return_capabilities(_r(status="草稿"), has_items=True)
    assert caps.update.allowed
    assert not caps.delete.allowed
    assert not caps.confirm.allowed


def test_returned_withdraw():
    caps = derive_sales_return_capabilities(_r(status="已退货"))
    assert caps.withdraw.allowed
    assert not caps.update.allowed


def test_confirm_requires_items():
    caps = derive_sales_return_capabilities(_r(), has_items=False)
    assert not caps.confirm.allowed


def test_assert_delete_returned_raises():
    with pytest.raises(BusinessLogicError):
        assert_sales_return_capability(_r(status="已退货"), "delete")


def test_confirm_requires_audit_when_enabled():
    caps = derive_sales_return_capabilities(_r(review_status="草稿"), has_items=True, audit_required=True)
    assert not caps.confirm.allowed
    assert caps.confirm.reason == "sales_return.confirm.not_audited"


def test_submit_from_draft_review():
    caps = derive_sales_return_capabilities(_r(review_status="草稿"), has_items=True, audit_required=True)
    assert caps.submit.allowed
    assert caps.update.allowed
