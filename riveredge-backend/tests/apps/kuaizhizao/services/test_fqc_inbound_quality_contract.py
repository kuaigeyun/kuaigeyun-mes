"""FQC 合格数入库封顶与部分合格语义。"""

import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.inspection_policy_service import (
    assert_fqc_for_finished_goods_receipt,
    fqc_inspection_passed_for_inbound,
    get_fqc_inbound_remaining_quantity,
    sum_fqc_inbound_qualified_quantity,
)
from infra.exceptions.exceptions import BusinessLogicError


def _item(*, material_id=1, receipt_quantity=10):
    return MagicMock(material_id=material_id, receipt_quantity=receipt_quantity, qualified_quantity=None)


def _fqc(*, qualified=60, status="已检验", review_status="通过", quality_status="不合格"):
    return MagicMock(
        material_id=1,
        qualified_quantity=qualified,
        status=status,
        review_status=review_status,
        quality_status=quality_status,
    )


def test_fqc_partial_unqualified_still_passes_when_qualified_positive():
    with patch(
        "infra.services.business_config_service.BusinessConfigService.check_audit_required",
        new=AsyncMock(return_value=True),
    ):
        ok = asyncio.run(
            fqc_inspection_passed_for_inbound(1, _fqc(qualified=30, quality_status="不合格"))
        )
    assert ok is True


def test_sum_fqc_qualified_aggregates_passed_inspections():
    inspections = [_fqc(qualified=40), _fqc(qualified=20)]

    async def _passed(_tenant, insp):
        return insp.qualified_quantity > 0

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        async def all(self):
            return inspections

    with patch(
        "apps.kuaizhizao.models.finished_goods_inspection.FinishedGoodsInspection.filter",
        return_value=FakeQuery(),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.fqc_inspection_passed_for_inbound",
        side_effect=_passed,
    ):
        total = asyncio.run(sum_fqc_inbound_qualified_quantity(1, 10, 1))
    assert total == Decimal("60")


def test_assert_fqc_rejects_receipt_over_qualified_remaining():
    line = _item(receipt_quantity=50)

    with patch(
        "apps.kuaizhizao.services.inspection_policy_service.get_quality_effective_config",
        new=AsyncMock(
            return_value={
                "gate": {"require_fqc_before_finished_goods_receipt": True},
                "stage_enabled": {},
                "module_enabled": {},
                "auto_create": {},
            }
        ),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.resolve_inspection_policy",
        new=AsyncMock(return_value=("plan", 1, None)),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.sum_fqc_inbound_qualified_quantity",
        new=AsyncMock(return_value=Decimal("60")),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.get_fqc_inbound_remaining_quantity",
        new=AsyncMock(return_value=Decimal("10")),
    ):
        with pytest.raises(BusinessLogicError, match="超过成品检验合格可入余量"):
            asyncio.run(assert_fqc_for_finished_goods_receipt(1, 99, 5, [line]))


def test_get_fqc_remaining_subtracts_confirmed_receipts():
    with patch(
        "apps.kuaizhizao.services.inspection_policy_service.sum_fqc_inbound_qualified_quantity",
        new=AsyncMock(return_value=Decimal("100")),
    ), patch(
        "apps.kuaizhizao.services.inspection_policy_service.sum_finished_goods_receipt_quantity_for_work_order",
        new=AsyncMock(return_value=Decimal("70")),
    ):
        remaining = asyncio.run(get_fqc_inbound_remaining_quantity(1, 5, 1))
    assert remaining == Decimal("30")
