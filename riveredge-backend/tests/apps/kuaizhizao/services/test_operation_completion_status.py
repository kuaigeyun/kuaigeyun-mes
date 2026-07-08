"""工序完成状态：以合格品数量为达标依据。"""

from decimal import Decimal
from types import SimpleNamespace

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
    )


def _wo(*, quantity=123):
    return SimpleNamespace(quantity=Decimal(str(quantity)))


def test_plan_quantity_reached_uses_qualified_only():
    work_order = _wo(quantity=123)
    assert _plan_quantity_reached(work_order, _op(completed=123, qualified=122)) is False
    assert _plan_quantity_reached(work_order, _op(completed=100, qualified=123)) is True


def test_reconcile_reopens_completed_when_qualified_below_plan():
    work_order = _wo(quantity=123)
    op = _op(status="completed", completed=123, qualified=122)
    assert _reconcile_operation_completion_status(work_order, op) is True
    assert op.status == "in_progress"
    assert op.actual_end_date is None


def test_sync_marks_completed_when_qualified_reaches_plan():
    work_order = _wo(quantity=123)
    op = _op(status="in_progress", completed=125, qualified=123)
    assert _sync_operation_completion_status(work_order, op) is True
    assert op.status == "completed"
