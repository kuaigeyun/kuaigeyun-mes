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


def test_match_equipment_payable_balance_status():
    from apps.haoligo.services.finance_equipment_payable import (
        match_equipment_payable_balance_status,
    )

    unpaid = Decimal("12.50")
    cleared = Decimal("0")
    assert match_equipment_payable_balance_status(unpaid=unpaid, status="all")
    assert match_equipment_payable_balance_status(unpaid=unpaid, status="unpaid")
    assert match_equipment_payable_balance_status(unpaid=unpaid, status="open")
    assert not match_equipment_payable_balance_status(unpaid=unpaid, status="paid")
    assert match_equipment_payable_balance_status(unpaid=cleared, status="paid")
    assert match_equipment_payable_balance_status(unpaid=cleared, status="cleared")
    assert not match_equipment_payable_balance_status(unpaid=cleared, status="unpaid")



def _awaitable_qs(result=None):
    """Tortoise QuerySet 链式调用后 await 返回 result。"""
    if result is None:
        result = []

    class _QS:
        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def offset(self, *args, **kwargs):
            return self

        def limit(self, *args, **kwargs):
            return self

        def __await__(self):
            async def _run():
                return result

            return _run().__await__()

    return _QS()


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
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable.assert_equipment_finance_payable_visible",
        new=AsyncMock(),
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
        "apps.haoligo.api.routes_finance_equipment_payable.assert_equipment_finance_payable_visible",
        new=AsyncMock(),
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
        "apps.haoligo.api.routes_finance_equipment_payable.assert_equipment_finance_payable_visible",
        new=AsyncMock(),
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
        "apps.haoligo.api.routes_finance_equipment_payable.assert_equipment_finance_payable_visible",
        new=AsyncMock(),
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
            user=SimpleNamespace(id=1),
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
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_payable.assert_equipment_finance_payable_visible",
        new=AsyncMock(),
    ):
        with pytest.raises(HTTPException) as exc:
            await submit_equipment_payable(
                payable_id=3,
                tenant_id=1,
                user=SimpleNamespace(id=9),
            )
    assert exc.value.status_code == 400
    assert "勿重复" in str(exc.value.detail)


def test_equipment_finance_data_scope_profiles_registered():
    from core.services.authorization.data_scope_resource_registry import get_resource_profile

    from apps.haoligo.authorization.data_scope_setup import register_haoligo_data_scope_profiles

    register_haoligo_data_scope_profiles()
    for resource in (
        "haoligo:finance-equipment-contracts",
        "haoligo:finance-equipment-payables",
        "haoligo:finance-reports-equipment-payable",
    ):
        profile = get_resource_profile(resource)
        assert profile is not None
        assert profile.partner_code_field == "manufacturer_code"
        assert profile.partner_dimension == "manufacturer"


@pytest.mark.asyncio
async def test_list_equipment_contracts_applies_data_scope():
    from apps.haoligo.api.routes_finance_equipment_contract import list_equipment_contracts

    scoped_qs = _awaitable_qs([])
    base_qs = MagicMock()
    base_qs.filter.return_value = base_qs
    with patch(
        "apps.haoligo.api.routes_finance_equipment_contract.tenant_alive",
        return_value=base_qs,
    ), patch(
        "apps.haoligo.api.routes_finance_equipment_contract.apply_equipment_finance_contract_scope",
        new=AsyncMock(return_value=scoped_qs),
    ) as apply_scope, patch(
        "apps.haoligo.api.routes_finance_equipment_contract.batch_lookup_user_names",
        new=AsyncMock(return_value={}),
    ):
        rows = await list_equipment_contracts(
            tenant_id=1,
            user=SimpleNamespace(id=1),
            manufacturer_id=None,
            keyword=None,
            skip=0,
            limit=50,
        )
    assert rows == []
    apply_scope.assert_awaited_once()


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


def test_equipment_payable_models_registered_in_orm_manifest():
    import importlib

    orm = importlib.import_module("apps.haoligo.orm_models")
    assert "apps.haoligo.models.finance_equipment_payable" in orm.ORM_MODEL_MODULES


def test_norm_uuid_list_extracts_object_entries():
    from apps.haoligo.services.finance_equipment_payable import (
        _norm_uuid_list,
        contract_attachment_needs_reupload,
    )

    assert _norm_uuid_list(["a1", "a1", ""]) == ["a1"]
    assert _norm_uuid_list([{"uid": "b2"}, {"uuid": "c3"}]) == ["b2", "c3"]
    # Upload 落库对象：优先 response.uuid，忽略 rc-upload 临时号
    assert _norm_uuid_list(
        [
            {
                "uid": "rc-upload-1",
                "name": "合同.pdf",
                "response": {"uuid": "11111111-1111-1111-1111-111111111111"},
            },
            "rc-upload-orphan",
            {"uid": "rc-upload-2", "response": [{"uuid": "22222222-2222-2222-2222-222222222222"}]},
        ]
    ) == [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
    ]
    assert contract_attachment_needs_reupload(["rc-upload-only"]) is True
    assert contract_attachment_needs_reupload([{"uid": "rc-upload-x"}]) is True
    assert contract_attachment_needs_reupload([]) is False
    assert contract_attachment_needs_reupload(["11111111-1111-1111-1111-111111111111"]) is False


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


def test_apply_equipment_finance_contract_scope_internal_uses_data_scope():
    import asyncio

    from apps.haoligo.api._data_scope import apply_equipment_finance_contract_scope

    base_qs = MagicMock()
    scoped_qs = MagicMock()

    async def run():
        with patch(
            "apps.haoligo.api._data_scope.UserPermissionService.is_admin_bypass",
            new=AsyncMock(return_value=False),
        ), patch(
            "apps.haoligo.api._data_scope.user_is_external_partner",
            new=AsyncMock(return_value=False),
        ), patch(
            "apps.haoligo.api._data_scope.DataScopeService.apply",
            new=AsyncMock(return_value=scoped_qs),
        ) as apply_mock:
            result = await apply_equipment_finance_contract_scope(
                base_qs,
                tenant_id=1,
                user=SimpleNamespace(id=9),
                resource="haoligo:finance-equipment-contracts",
            )
            apply_mock.assert_awaited_once()
            return result

    result = asyncio.run(run())
    assert result is scoped_qs


def test_apply_equipment_finance_contract_scope_manufacturer_uses_bound_code_not_self():
    import asyncio

    from apps.haoligo.api._data_scope import apply_equipment_finance_contract_scope

    base_qs = MagicMock()
    filtered = MagicMock()
    base_qs.filter.return_value = filtered
    role = SimpleNamespace(role_type="external", external_partner_type="manufacturer")

    async def run():
        with patch(
            "apps.haoligo.api._data_scope.UserPermissionService.is_admin_bypass",
            new=AsyncMock(return_value=False),
        ), patch(
            "apps.haoligo.api._data_scope.user_is_external_partner",
            new=AsyncMock(return_value=True),
        ), patch(
            "apps.haoligo.api._data_scope.DataScopeService._load_active_roles",
            new=AsyncMock(return_value=[role]),
        ), patch(
            "core.services.authorization.user_data_scope_binding_service.UserDataScopeBindingService.list_scope_codes",
            new=AsyncMock(return_value=["ZW"]),
        ), patch(
            "apps.haoligo.api._data_scope.DataScopeService.apply",
            new=AsyncMock(),
        ) as apply_mock:
            result = await apply_equipment_finance_contract_scope(
                base_qs,
                tenant_id=1,
                user=SimpleNamespace(id=9),
                resource="haoligo:finance-equipment-contracts",
            )
            apply_mock.assert_not_called()
            return result

    result = asyncio.run(run())
    assert result is filtered
    base_qs.filter.assert_called_once_with(manufacturer_code__in=["ZW"])

