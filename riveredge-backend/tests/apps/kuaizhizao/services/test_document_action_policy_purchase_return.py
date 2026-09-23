"""采购退货单 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.purchase_return import (
    assert_purchase_return_capability,
    derive_purchase_return_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _r(**kwargs):
    defaults = {"status": "待退货", "review_status": "草稿"}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_confirm_requires_approved_review_even_when_audit_disabled():
    """未审核（草稿/待审核）禁止确认；与是否开启人工审核无关。"""
    for review in ("草稿", "待审核", ""):
        caps = derive_purchase_return_capabilities(
            _r(review_status=review),
            has_items=True,
            audit_required=False,
        )
        assert not caps.confirm.allowed
        assert caps.confirm.reason == "purchase_return.confirm.not_audited"

    with pytest.raises(BusinessLogicError):
        assert_purchase_return_capability(
            _r(review_status="草稿"),
            "confirm",
            has_items=True,
            audit_required=False,
        )


def test_confirm_requires_audit_when_enabled():
    caps = derive_purchase_return_capabilities(
        _r(review_status="草稿"),
        has_items=True,
        audit_required=True,
    )
    assert not caps.confirm.allowed
    assert caps.confirm.reason == "purchase_return.confirm.not_audited"

    with pytest.raises(BusinessLogicError):
        assert_purchase_return_capability(
            _r(review_status="草稿"),
            "confirm",
            has_items=True,
            audit_required=True,
        )


def test_confirm_allowed_when_review_approved():
    for audit_required in (True, False):
        approved = derive_purchase_return_capabilities(
            _r(review_status="审核通过"),
            has_items=True,
            audit_required=audit_required,
        )
        assert approved.confirm.allowed


def test_returned_draft_can_submit_to_unlock_audit():
    """已退货但审核仍草稿：允许补提交（自动通过或进人审）。"""
    caps = derive_purchase_return_capabilities(
        _r(status="已退货", review_status="草稿"),
        has_items=True,
        audit_required=False,
    )
    assert caps.submit.allowed
    assert not caps.confirm.allowed
