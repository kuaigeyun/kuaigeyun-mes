"""工序完成状态：以有效合格数量为达标依据（方案质检为检验放行数）。"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.services.reporting_service import (
    _plan_quantity_reached,
    _reconcile_operation_completion_status,
    _sync_operation_completion_status,
)


def _op(*, status="in_progress", reporting_type="quantity", completed=0, qualified=0):
    return SimpleNamespace(
        status=status,
        reporting_type=reporting_type,
        completed_quantity=Decimal(str(completed)),
        qualified_quantity=Decimal(str(qualified)),
        actual_end_date="2026-07-08",
        operation_id=10,
    )


def _wo(*, quantity=123, id=1):
    return SimpleNamespace(id=id, quantity=Decimal(str(quantity)))


def _patch_effective_qty():
    return patch(
        "apps.kuaizhizao.services.reporting_service._effective_completion_quantity",
        new_callable=AsyncMock,
        side_effect=lambda _tid, _wid, woo: Decimal(str(woo.qualified_quantity or 0)),
    )


@pytest.mark.asyncio
async def test_plan_quantity_reached_uses_effective_qualified_only():
    work_order = _wo(quantity=123)
    with _patch_effective_qty():
        assert await _plan_quantity_reached(1, work_order, _op(completed=123, qualified=122)) is False
        assert await _plan_quantity_reached(1, work_order, _op(completed=100, qualified=123)) is True


@pytest.mark.asyncio
async def test_reconcile_reopens_completed_when_effective_below_plan():
    work_order = _wo(quantity=123)
    op = _op(status="completed", completed=123, qualified=122)
    with _patch_effective_qty():
        assert await _reconcile_operation_completion_status(1, work_order, op) is True
    assert op.status == "in_progress"
    assert op.actual_end_date is None


@pytest.mark.asyncio
async def test_sync_marks_completed_when_effective_reaches_plan():
    work_order = _wo(quantity=123)
    op = _op(status="in_progress", completed=125, qualified=123)
    with _patch_effective_qty():
        assert await _sync_operation_completion_status(1, work_order, op) is True
    assert op.status == "completed"


@pytest.mark.asyncio
async def test_sync_keeps_in_progress_when_plan_qc_not_released():
    """方案质检：报工合格已满但检验放行未满 → 不得标完成。"""
    work_order = _wo(quantity=100)
    op = _op(status="in_progress", completed=100, qualified=100)
    with patch(
        "apps.kuaizhizao.services.reporting_service._effective_completion_quantity",
        new_callable=AsyncMock,
        return_value=Decimal("0"),
    ):
        assert await _sync_operation_completion_status(1, work_order, op) is False
    assert op.status == "in_progress"


@pytest.mark.asyncio
async def test_reconcile_reopens_when_plan_qc_not_released():
    work_order = _wo(quantity=100)
    op = _op(status="completed", completed=100, qualified=100)
    with patch(
        "apps.kuaizhizao.services.reporting_service._effective_completion_quantity",
        new_callable=AsyncMock,
        return_value=Decimal("0"),
    ):
        assert await _reconcile_operation_completion_status(1, work_order, op) is True
    assert op.status == "in_progress"
