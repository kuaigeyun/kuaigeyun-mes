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
async def test_submit_allows_missing_invoice_and_acceptance():
    """允许先提交财务再补发票/验收单。"""
    from apps.haoligo.api.routes_finance_equipment_payable import submit_equipment_payable
    from apps.haoligo.constants.finance_equipment_payable import WORKFLOW_DRAFT, WORKFLOW_SUBMITTED

    row = SimpleNamespace(
        id=3,
        tenant_id=1,
        workflow_status=WORKFLOW_DRAFT,
        install_location=None,
        invoice_file_uuids=[],
        acceptance_file_uuids=[],
        acceptance_uploaded_at=None,
        reporter_user_id=1,
        submitted_by_user_id=None,
        submitted_at=None,
        save=AsyncMock(),
    )
    out = SimpleNamespace(id=3, workflow_status=WORKFLOW_SUBMITTED)
    with patch(
        "apps.haoligo.api.routes_finance_equipment_payable.tenant_alive",
        return_value=_qs_first(row),
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable.resolve_business_datetime",
        return_value=datetime(2026, 8, 17, 12, 0, 0, tzinfo=timezone.utc),
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable.batch_lookup_user_names",
        new=AsyncMock(return_value={1: "甲", 9: "乙"}),
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable._serialize_payable",
        new=AsyncMock(return_value=out),
    ):
        result = await submit_equipment_payable(
            payable_id=3,
            tenant_id=1,
            user=SimpleNamespace(id=9),
        )
    assert result is out
    assert row.workflow_status == WORKFLOW_SUBMITTED
    assert row.submitted_by_user_id == 9
    row.save.assert_awaited()


@pytest.mark.asyncio
async def test_update_payable_allowed_after_submit():
    """已提交后仍可补传位置/发票/验收单。"""
    from apps.haoligo.api.routes_finance_equipment_payable import (
        EquipmentPayableUpdate,
        update_equipment_payable,
    )
    from apps.haoligo.constants.finance_equipment_payable import WORKFLOW_SUBMITTED

    row = SimpleNamespace(
        id=5,
        tenant_id=1,
        workflow_status=WORKFLOW_SUBMITTED,
        install_location=None,
        invoice_file_uuids=[],
        acceptance_file_uuids=[],
        acceptance_uploaded_at=None,
        reporter_user_id=1,
        submitted_by_user_id=2,
        save=AsyncMock(),
    )
    out = SimpleNamespace(id=5)
    body = EquipmentPayableUpdate(
        install_location="二车间",
        invoice_file_uuids=["inv-1"],
        acceptance_file_uuids=["acc-1"],
    )
    with patch(
        "apps.haoligo.api.routes_finance_equipment_payable.tenant_alive",
        return_value=_qs_first(row),
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable.batch_lookup_user_names",
        new=AsyncMock(return_value={}),
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable._serialize_payable",
        new=AsyncMock(return_value=out),
    ):
        result = await update_equipment_payable(
            payable_id=5,
            body=body,
            tenant_id=1,
            _=SimpleNamespace(id=1),
        )
    assert result is out
    assert row.install_location == "二车间"
    assert row.invoice_file_uuids == ["inv-1"]
    assert row.acceptance_file_uuids == ["acc-1"]
    row.save.assert_awaited()


@pytest.mark.asyncio
async def test_submit_rejects_duplicate():
    from apps.haoligo.api.routes_finance_equipment_payable import submit_equipment_payable
    from apps.haoligo.constants.finance_equipment_payable import WORKFLOW_SUBMITTED

    row = SimpleNamespace(
        id=3,
        tenant_id=1,
        workflow_status=WORKFLOW_SUBMITTED,
        save=AsyncMock(),
    )
    with patch(
        "apps.haoligo.api.routes_finance_equipment_payable.tenant_alive",
        return_value=_qs_first(row),
    ):
        with pytest.raises(HTTPException) as exc:
            await submit_equipment_payable(
                payable_id=3,
                tenant_id=1,
                user=SimpleNamespace(id=9),
            )
    assert exc.value.status_code == 400
    assert "勿重复" in str(exc.value.detail)


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
