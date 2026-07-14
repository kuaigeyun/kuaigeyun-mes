"""Coordination board service unit tests."""

from apps.kuaizhizao.services.coordination_board_service import (
    _CLOSED_SALES_ORDER_STATUSES,
    _TERMINAL_WORK_ORDER_STATUSES,
)


def test_terminal_work_order_statuses():
    assert "completed" in _TERMINAL_WORK_ORDER_STATUSES
    assert "cancelled" in _TERMINAL_WORK_ORDER_STATUSES
    assert "released" not in _TERMINAL_WORK_ORDER_STATUSES


def test_closed_sales_order_statuses_include_fulfilled_states():
    assert "已出库" in _CLOSED_SALES_ORDER_STATUSES
    assert "COMPLETED" in _CLOSED_SALES_ORDER_STATUSES
