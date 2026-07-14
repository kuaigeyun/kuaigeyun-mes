"""工序转下道数量：方案质检须过程检验放行。"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.services.inspection_policy_service import ipqc_inspection_passed_for_transfer
from apps.kuaizhizao.services.operation_transfer_service import (
    resolve_operation_transfer_qualified,
    resolve_process_inspection_card_status,
    sum_plan_transfer_qualified_from_inspections,
)


def _woo(*, operation_id=1, qualified=0):
    return SimpleNamespace(operation_id=operation_id, qualified_quantity=Decimal(str(qualified)))


def _insp(*, status="已检验", quality_status="合格", qualified=0, review_status="通过"):
    return SimpleNamespace(
        status=status,
        quality_status=quality_status,
        qualified_quantity=Decimal(str(qualified)),
        review_status=review_status,
    )


@pytest.mark.asyncio
async def test_sum_plan_transfer_only_counts_passed():
    inspections = [
        _insp(qualified=50),
        _insp(status="待检验", qualified=30),
        _insp(quality_status="不合格", qualified=10),
    ]
    with patch(
        "apps.kuaizhizao.services.operation_transfer_service.ipqc_inspection_passed_for_transfer",
        new=AsyncMock(side_effect=[True, False, False]),
    ):
        total = await sum_plan_transfer_qualified_from_inspections(1, inspections)
    assert total == Decimal("50")


@pytest.mark.asyncio
async def test_resolve_transfer_simple_uses_reporting_qualified():
    woo = _woo(qualified=80)
    with patch(
        "apps.kuaizhizao.services.operation_transfer_service.resolve_inspection_policy",
        new=AsyncMock(return_value=("simple", None, "operation")),
    ):
        qty = await resolve_operation_transfer_qualified(1, 10, woo)
    assert qty == Decimal("80")


@pytest.mark.asyncio
async def test_resolve_transfer_plan_uses_inspection_sum():
    woo = _woo(qualified=100)
    inspections = [_insp(qualified=60)]
    inspections_by_op = {1: inspections}
    policy_cache = {1: ("plan", 5, "operation")}
    with patch(
        "apps.kuaizhizao.services.operation_transfer_service.sum_plan_transfer_qualified_from_inspections",
        new=AsyncMock(return_value=Decimal("60")),
    ):
        qty = await resolve_operation_transfer_qualified(
            1,
            10,
            woo,
            policy_cache=policy_cache,
            inspections_by_op=inspections_by_op,
        )
    assert qty == Decimal("60")


def test_resolve_process_inspection_link_id_prefers_pending():
    from apps.kuaizhizao.services.operation_transfer_service import resolve_process_inspection_link_id

    inspections = [
        SimpleNamespace(id=10, status="已检验"),
        SimpleNamespace(id=20, status="待检验"),
    ]
    assert resolve_process_inspection_link_id(inspections) == 20


@pytest.mark.asyncio
async def test_process_inspection_card_status_pending():
    status = await resolve_process_inspection_card_status(1, [_insp(status="待检验")])
    assert status == "pending"


@pytest.mark.asyncio
async def test_process_inspection_card_status_inspected_ignores_quality_result():
    status = await resolve_process_inspection_card_status(
        1, [_insp(status="已检验", quality_status="不合格")]
    )
    assert status == "inspected"


@pytest.mark.asyncio
async def test_process_inspection_card_status_not_started_without_reporting():
    status = await resolve_process_inspection_card_status(1, [])
    assert status == "not_started"


def test_sum_process_inspection_quality_quantities():
    from apps.kuaizhizao.services.operation_transfer_service import (
        sum_process_inspection_quality_quantities,
    )

    q, u = sum_process_inspection_quality_quantities(
        [
            _insp(status="已检验", qualified=99),
            SimpleNamespace(
                status="已检验",
                quality_status="不合格",
                qualified_quantity=Decimal("0"),
                unqualified_quantity=Decimal("1"),
                review_status="通过",
            ),
            _insp(status="待检验", qualified=10),
        ]
    )
    assert q == Decimal("99")
    assert u == Decimal("1")


@pytest.mark.asyncio
async def test_ipqc_passed_without_audit_when_conducted():
    with patch(
        "infra.services.business_config_service.BusinessConfigService.check_audit_required",
        new=AsyncMock(return_value=False),
    ):
        ok = await ipqc_inspection_passed_for_transfer(
            1, _insp(status="已检验", qualified=50)
        )
    assert ok is True


@pytest.mark.asyncio
async def test_ipqc_partial_unqualified_still_transfers_qualified_qty():
    """整单不合格但有合格数量时，仍可计入转下道。"""
    with patch(
        "infra.services.business_config_service.BusinessConfigService.check_audit_required",
        new=AsyncMock(return_value=False),
    ):
        ok = await ipqc_inspection_passed_for_transfer(
            1, _insp(status="已检验", quality_status="不合格", qualified=99)
        )
        zero = await ipqc_inspection_passed_for_transfer(
            1, _insp(status="已检验", quality_status="不合格", qualified=0)
        )
    assert ok is True
    assert zero is False
    total = await sum_plan_transfer_qualified_from_inspections(
        1, [_insp(status="已检验", quality_status="不合格", qualified=99)]
    )
    assert total == Decimal("99")


@pytest.mark.asyncio
async def test_ipqc_requires_review_when_audit_enabled():
    with patch(
        "infra.services.business_config_service.BusinessConfigService.check_audit_required",
        new=AsyncMock(return_value=True),
    ):
        pending = await ipqc_inspection_passed_for_transfer(
            1, _insp(status="已检验", review_status="待审核", qualified=10)
        )
        approved = await ipqc_inspection_passed_for_transfer(
            1, _insp(status="已审核", review_status="通过", qualified=10)
        )
        approved_alias = await ipqc_inspection_passed_for_transfer(
            1, _insp(status="已检验", review_status="已通过", qualified=10)
        )
    assert pending is False
    assert approved is True
    assert approved_alias is True
