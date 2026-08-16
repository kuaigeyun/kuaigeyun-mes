"""Coordination board service unit tests."""

from apps.kuaizhizao.services.coordination_board_service import (
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_MAKE,
    CoordinationBoardService,
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


def test_compute_bom_status_pending_when_no_lines():
    status, _, blockers, missing = CoordinationBoardService._compute_bom_status(
        [], {}, {}
    )
    assert status == "pending"
    assert blockers
    assert missing == []


def test_compute_bom_status_skipped_for_buy_only():
    status, _, blockers, missing = CoordinationBoardService._compute_bom_status(
        [(1, "M1", "外购件")],
        {1: SOURCE_TYPE_BUY},
        {},
    )
    assert status == "skipped"
    assert blockers == []
    assert missing == []


def test_compute_bom_status_done_partial_blocked():
    lines = [(1, "A", "自制A"), (2, "B", "自制B")]
    sources = {1: SOURCE_TYPE_MAKE, 2: SOURCE_TYPE_MAKE}

    done, _, _, missing = CoordinationBoardService._compute_bom_status(
        lines, sources, {1: True, 2: True}
    )
    assert done == "done"
    assert missing == []

    partial, _, blockers, missing = CoordinationBoardService._compute_bom_status(
        lines, sources, {1: True, 2: False}
    )
    assert partial == "partial"
    assert missing == [2]
    assert any("B" in item for item in blockers)

    blocked, _, _, missing = CoordinationBoardService._compute_bom_status(
        lines, sources, {1: False, 2: False}
    )
    assert blocked == "blocked"
    assert missing == [1, 2]
