"""报价单 document_action_policy 单元测试。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.quotation import (
    assert_quotation_capability,
    derive_quotation_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _q(**kwargs):
    defaults = {
        "status": "草稿",
        "review_status": "待审核",
        "is_latest_in_series": True,
        "superseded_by_id": None,
        "sales_order_id": None,
        "contract_id": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_draft_delete_and_submit_allowed():
    caps = derive_quotation_capabilities(_q(), audit_required=True)
    assert caps.delete.allowed
    assert caps.submit.allowed
    assert not caps.convert_to_order.allowed


def test_sent_pending_delete_and_update_allowed():
    caps = derive_quotation_capabilities(
        _q(status="已发送", review_status="待审核"),
        audit_required=True,
    )
    assert caps.delete.allowed
    assert caps.update.allowed
    assert caps.withdraw_submit.allowed
    assert caps.approve.allowed
    assert not caps.revoke_approval.allowed
    assert not caps.confirm_customer.allowed
    assert not caps.convert_to_order.allowed


def test_sent_approved_revoke_approval_allowed():
    caps = derive_quotation_capabilities(
        _q(status="已发送", review_status="审核通过"),
        audit_required=True,
    )
    assert caps.revoke_approval.allowed
    assert not caps.withdraw_submit.allowed
    assert not caps.approve.allowed


def test_sent_approved_convert_and_confirm():
    caps = derive_quotation_capabilities(
        _q(status="已发送", review_status="审核通过"),
        audit_required=True,
    )
    assert caps.confirm_customer.allowed
    assert caps.convert_to_order.allowed
    assert caps.convert_to_contract.allowed
    assert caps.print_formal.allowed


def test_sent_without_audit_required():
    caps = derive_quotation_capabilities(
        _q(status="已发送", review_status=""),
        audit_required=False,
    )
    assert caps.confirm_customer.allowed
    assert caps.convert_to_order.allowed
    assert caps.print_formal.allowed


def test_accepted_with_stale_sales_order_id_still_allows_convert():
    caps = derive_quotation_capabilities(
        _q(status="已接受", review_status="审核通过", sales_order_id=999),
        audit_required=True,
        conversion_downstream_missing=False,
    )
    assert caps.convert_to_order.allowed
    caps = derive_quotation_capabilities(
        _q(status="已接受", review_status="审核通过"),
        audit_required=True,
    )
    assert caps.convert_to_order.allowed
    assert caps.convert_to_contract.allowed


def test_linked_contract_blocks_convert_order():
    caps = derive_quotation_capabilities(
        _q(status="已接受", review_status="审核通过", contract_id=99),
        audit_required=True,
    )
    assert not caps.convert_to_order.allowed
    assert caps.convert_to_order.reason == "quotation.convert_order.linked_contract"


def test_stale_contract_id_allows_convert_when_contract_missing():
    caps = derive_quotation_capabilities(
        _q(status="已接受", review_status="审核通过", contract_id=99),
        audit_required=True,
        contract_downstream_missing=True,
    )
    assert caps.convert_to_order.allowed
    assert caps.convert_to_contract.allowed


def test_accepted_allows_cancel_customer_confirm():
    caps = derive_quotation_capabilities(
        _q(status="已接受", review_status="审核通过"),
        audit_required=True,
    )
    assert caps.cancel_customer_confirm.allowed
    assert not caps.confirm_customer.allowed


def test_accepted_with_contract_blocks_cancel_customer_confirm():
    caps = derive_quotation_capabilities(
        _q(status="已接受", review_status="审核通过", contract_id=1),
        audit_required=True,
    )
    assert not caps.cancel_customer_confirm.allowed
    assert caps.cancel_customer_confirm.reason == "quotation.cancel_customer_confirm.linked_contract"


def test_converted_downstream_missing():
    caps = derive_quotation_capabilities(
        _q(status="已转订单", sales_order_id=1),
        audit_required=True,
        conversion_downstream_missing=True,
    )
    assert caps.delete.allowed
    assert caps.convert_to_order.allowed
    assert caps.convert_to_contract.allowed
    assert caps.revoke_push.allowed


def test_assert_capability_raises():
    with pytest.raises(BusinessLogicError):
        assert_quotation_capability(
            _q(status="已接受", review_status="审核通过"),
            "delete",
            audit_required=True,
        )


def test_audit_phase_no_revoke_on_accepted():
    from core.services.approval.audit_phase import derive_audit_phase

    audit = derive_audit_phase(
        "quotation",
        "已接受",
        "审核通过",
        enabled=True,
    )
    assert "revoke" not in audit["allowed_actions"]
