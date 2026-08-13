"""设备合同登记 / 设备应付款业务契约。"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from apps.haoligo.services.finance_equipment_payable import (
    _norm_uuid_list,
    maybe_set_acceptance_uploaded_at,
)


def test_norm_uuid_list_dedupes_and_strips():
    assert _norm_uuid_list([" a ", "a", "", None, "b"]) == ["a", "b"]  # type: ignore[list-item]


def test_acceptance_uploaded_at_set_only_on_first_non_empty():
    fixed = datetime(2026, 8, 14, 3, 0, 0, tzinfo=timezone.utc)
    row = SimpleNamespace(acceptance_uploaded_at=None, acceptance_file_uuids=[])
    with patch(
        "apps.haoligo.services.finance_equipment_payable.resolve_business_datetime",
        return_value=fixed,
    ):
        maybe_set_acceptance_uploaded_at(row, next_acceptance_uuids=["u1"])
        assert row.acceptance_uploaded_at == fixed
        maybe_set_acceptance_uploaded_at(row, next_acceptance_uuids=["u2"])
        assert row.acceptance_uploaded_at == fixed


def test_acceptance_uploaded_at_not_set_when_still_empty():
    row = SimpleNamespace(acceptance_uploaded_at=None, acceptance_file_uuids=[])
    maybe_set_acceptance_uploaded_at(row, next_acceptance_uuids=[])
    assert row.acceptance_uploaded_at is None


def _qs_first(row):
    qs = MagicMock()
    qs.filter.return_value = qs
    qs.first = AsyncMock(return_value=row)
    qs.exists = AsyncMock(return_value=row is not None)
    return qs


@pytest.mark.asyncio
async def test_assert_no_alive_payable_for_contract_conflict():
    from apps.haoligo.services.finance_equipment_payable import assert_no_alive_payable_for_contract

    qs = _qs_first(object())
    qs.exists = AsyncMock(return_value=True)
    with patch("apps.haoligo.services.finance_equipment_payable._tenant_alive", return_value=qs):
        with pytest.raises(HTTPException) as exc:
            await assert_no_alive_payable_for_contract(1, 99)
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_unpaid_amount_and_overpay_guard_logic():
    from apps.haoligo.api.routes_finance_equipment_payable import create_equipment_payable_payment
    from apps.haoligo.constants.finance_equipment_payable import WORKFLOW_DRAFT, WORKFLOW_SUBMITTED

    payable = SimpleNamespace(
        id=7,
        tenant_id=1,
        workflow_status=WORKFLOW_SUBMITTED,
        tax_inclusive_amount=Decimal("100.00"),
    )
    draft = SimpleNamespace(
        id=7,
        tenant_id=1,
        workflow_status=WORKFLOW_DRAFT,
        tax_inclusive_amount=Decimal("100.00"),
    )
    body = SimpleNamespace(
        amount=Decimal("10"),
        paid_at=datetime(2026, 8, 1, 12, 0, 0),
        remark=None,
    )

    with patch(
        "apps.haoligo.api.routes_finance_equipment_payable.tenant_alive",
        return_value=_qs_first(draft),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_equipment_payable_payment(
                payable_id=7,
                body=body,  # type: ignore[arg-type]
                tenant_id=1,
                user=SimpleNamespace(id=1),
            )
        assert exc.value.status_code == 400
        assert "未提交" in str(exc.value.detail)

    with patch(
        "apps.haoligo.api.routes_finance_equipment_payable.tenant_alive",
        return_value=_qs_first(payable),
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable.unpaid_amount",
        new=AsyncMock(return_value=Decimal("5.00")),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_equipment_payable_payment(
                payable_id=7,
                body=body,  # type: ignore[arg-type]
                tenant_id=1,
                user=SimpleNamespace(id=1),
            )
        assert exc.value.status_code == 400
        assert "未付" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_submit_requires_invoice_acceptance_location():
    from apps.haoligo.api.routes_finance_equipment_payable import submit_equipment_payable
    from apps.haoligo.constants.finance_equipment_payable import WORKFLOW_DRAFT

    def make_row(**overrides):
        base = dict(
            id=3,
            tenant_id=1,
            workflow_status=WORKFLOW_DRAFT,
            install_location=None,
            invoice_file_uuids=[],
            acceptance_file_uuids=[],
            acceptance_uploaded_at=None,
            reporter_user_id=1,
            submitted_by_user_id=None,
            save=AsyncMock(),
        )
        base.update(overrides)
        return SimpleNamespace(**base)

    async def _run(row):
        with patch(
            "apps.haoligo.api.routes_finance_equipment_payable.tenant_alive",
            return_value=_qs_first(row),
        ):
            await submit_equipment_payable(
                payable_id=3,
                tenant_id=1,
                user=SimpleNamespace(id=9),
            )

    with pytest.raises(HTTPException) as e1:
        await _run(make_row())
    assert "位置" in str(e1.value.detail)

    with pytest.raises(HTTPException) as e2:
        await _run(make_row(install_location="一车间"))
    assert "发票" in str(e2.value.detail)

    with pytest.raises(HTTPException) as e3:
        await _run(make_row(install_location="一车间", invoice_file_uuids=["inv-1"]))
    assert "验收" in str(e3.value.detail)


def test_equipment_payable_routes_importable():
    import importlib

    contract_mod = importlib.import_module("apps.haoligo.api.routes_finance_equipment_contract")
    payable_mod = importlib.import_module("apps.haoligo.api.routes_finance_equipment_payable")
    reports_mod = importlib.import_module("apps.haoligo.api.routes_finance_reports")
    assert contract_mod.router.prefix == "/finance/equipment-contracts"
    assert payable_mod.router.prefix == "/finance/equipment-payables"
    assert reports_mod.equipment_payable_router.prefix == "/finance/reports/equipment-payable"


def test_equipment_models_exported():
    import importlib

    mod = importlib.import_module("apps.haoligo.models")
    assert hasattr(mod, "HaoligoFinanceEquipmentContract")
    assert hasattr(mod, "HaoligoFinanceEquipmentPayable")
    assert hasattr(mod, "HaoligoFinanceEquipmentPayablePayment")


def test_route_access_maps_payments_to_execute():
    from apps.haoligo.api._haoligo_route_access import resolve_haoligo_module_action

    assert (
        resolve_haoligo_module_action(
            "POST", "/api/v1/apps/haoligo/finance/equipment-payables/1/payments"
        )
        == "execute"
    )
    assert (
        resolve_haoligo_module_action(
            "DELETE", "/api/v1/apps/haoligo/finance/equipment-payables/1/payments/2"
        )
        == "execute"
    )
    assert (
        resolve_haoligo_module_action(
            "POST", "/api/v1/apps/haoligo/finance/equipment-payables/1/submit"
        )
        == "submit"
    )
