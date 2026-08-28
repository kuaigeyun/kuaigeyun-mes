"""框架合同金额总框（enter_line_items=false）校验与 capability。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.sales_contract import (
    derive_sales_contract_capabilities,
)
from apps.kuaizhizao.services.sales_contract_service import SalesContractService
from infra.exceptions.exceptions import ValidationError


def test_amount_framework_rejects_empty_amount():
    svc = SalesContractService()
    with pytest.raises(ValidationError) as exc:
        svc._validate_framework_mode_payload(
            enter_line_items=False,
            items=[],
            total_amount=Decimal("0"),
            valid_from=date(2026, 1, 1),
            valid_to=date(2026, 12, 31),
        )
    assert "总金额" in str(exc.value)


def test_amount_framework_rejects_line_items():
    svc = SalesContractService()
    with pytest.raises(ValidationError) as exc:
        svc._validate_framework_mode_payload(
            enter_line_items=False,
            items=[SimpleNamespace()],  # type: ignore[list-item]
            total_amount=Decimal("100"),
            valid_from=date(2026, 1, 1),
            valid_to=date(2026, 12, 31),
        )
    assert "不允许录入合同明细" in str(exc.value)


def test_amount_framework_requires_validity():
    svc = SalesContractService()
    with pytest.raises(ValidationError) as exc:
        svc._validate_framework_mode_payload(
            enter_line_items=False,
            items=[],
            total_amount=Decimal("100"),
            valid_from=date(2026, 1, 1),
            valid_to=None,
        )
    assert "生效日期" in str(exc.value) or "终止日期" in str(exc.value)


def test_amount_framework_ok():
    svc = SalesContractService()
    items, qty, amt = svc._validate_framework_mode_payload(
        enter_line_items=False,
        items=[],
        total_amount=Decimal("50000"),
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 12, 31),
    )
    assert items == []
    assert qty == Decimal("0")
    assert amt == Decimal("50000")


def test_quantity_framework_still_requires_items():
    svc = SalesContractService()
    with pytest.raises(ValidationError) as exc:
        svc._validate_framework_mode_payload(
            enter_line_items=True,
            items=[],
            total_amount=None,
            valid_from=None,
            valid_to=None,
        )
    assert "合同明细不能为空" in str(exc.value)


def test_capability_blocks_push_for_amount_framework():
    contract = SimpleNamespace(
        status="已生效",
        review_status="APPROVED",
        enter_line_items=False,
        released_quantity=0,
        released_amount=0,
        total_amount=Decimal("10000"),
        contract_type="framework",
        valid_from=date(2026, 1, 1),
    )
    caps = derive_sales_contract_capabilities(
        contract,
        has_items=False,
        has_releasable_items=False,
        remaining_amount=Decimal("10000"),
        today=date(2026, 6, 1),
    )
    assert caps.push_to_sales_order.allowed is False
    assert caps.push_to_sales_order.reason == "sales_contract.push.amount_framework"
