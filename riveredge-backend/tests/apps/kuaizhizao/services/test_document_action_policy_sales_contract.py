"""销售合同 document_action_policy 单元测试。"""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.sales_contract import (
    assert_sales_contract_capability,
    derive_sales_contract_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _c(**kwargs):
    defaults = {
        "status": "草稿",
        "review_status": "PENDING",
        "released_quantity": 0,
        "released_amount": 0,
        "total_amount": 1000,
        "contract_type": "framework",
        "valid_from": date(2020, 1, 1),
        "valid_to": date(2030, 12, 31),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_draft_crud():
    caps = derive_sales_contract_capabilities(_c())
    assert caps.update.allowed
    assert caps.delete.allowed
    assert caps.submit.allowed
    assert not caps.push_to_sales_order.allowed


def test_pending_review_delete_allowed():
    caps = derive_sales_contract_capabilities(_c(status="待审核", review_status="PENDING"))
    assert caps.update.allowed
    assert caps.delete.allowed
    assert not caps.submit.allowed


def test_effective_push_with_remaining():
    caps = derive_sales_contract_capabilities(
        _c(status="已生效", review_status="APPROVED"),
        has_items=True,
        has_releasable_items=True,
        remaining_amount=Decimal("500"),
    )
    assert caps.push_to_sales_order.allowed
    assert caps.create_change.allowed


def test_revoke_blocked_when_released():
    caps = derive_sales_contract_capabilities(
        _c(status="已生效", review_status="APPROVED", released_amount=100),
    )
    assert not caps.revoke_approval.allowed


def test_assert_delete_audited_raises():
    with pytest.raises(BusinessLogicError):
        assert_sales_contract_capability(_c(status="已生效", review_status="APPROVED"), "delete")
