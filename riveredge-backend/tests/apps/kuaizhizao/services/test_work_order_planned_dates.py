"""工单计划时间锁定辅助函数单元测试。"""

from datetime import datetime, timezone

import pytest

from apps.kuaizhizao.services.work_order_service import (
    _assert_work_order_planned_dates_unchanged_or_editable,
    _business_datetimes_equal,
    _is_schedulable_work_order_status,
    _is_work_order_planned_dates_locked_status,
)
from infra.exceptions.exceptions import BusinessLogicError


def test_business_datetimes_equal_none():
    assert _business_datetimes_equal(None, None) is True
    assert _business_datetimes_equal(None, datetime(2026, 1, 1, tzinfo=timezone.utc)) is False


def test_business_datetimes_equal_same_utc():
    left = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
    right = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
    assert _business_datetimes_equal(left, right) is True


def test_is_schedulable_work_order_status():
    assert _is_schedulable_work_order_status("draft") is True
    assert _is_schedulable_work_order_status("released") is True
    assert _is_schedulable_work_order_status("in_progress") is True
    assert _is_schedulable_work_order_status("completed") is False
    assert _is_schedulable_work_order_status("已完成") is False
    assert _is_schedulable_work_order_status("cancelled") is False


def test_is_work_order_planned_dates_locked_status():
    assert _is_work_order_planned_dates_locked_status("completed") is True
    assert _is_work_order_planned_dates_locked_status("已完成") is True
    assert _is_work_order_planned_dates_locked_status("cancelled") is True
    assert _is_work_order_planned_dates_locked_status("in_progress") is False
    assert _is_work_order_planned_dates_locked_status("执行中") is False
    assert _is_work_order_planned_dates_locked_status("released") is False


def test_assert_planned_dates_editable_for_draft():
    wo = type("WO", (), {"status": "draft", "planned_start_date": None, "planned_end_date": None})()
    _assert_work_order_planned_dates_unchanged_or_editable(
        wo,
        {"planned_start_date": datetime(2026, 2, 1, tzinfo=timezone.utc)},
    )


def test_assert_planned_dates_locked_for_completed():
    wo = type(
        "WO",
        (),
        {
            "status": "completed",
            "planned_start_date": datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc),
            "planned_end_date": datetime(2026, 1, 2, 8, 0, tzinfo=timezone.utc),
        },
    )()
    with pytest.raises(BusinessLogicError, match="已结束工单不可修改"):
        _assert_work_order_planned_dates_unchanged_or_editable(
            wo,
            {"planned_start_date": datetime(2026, 2, 1, tzinfo=timezone.utc)},
        )


def test_assert_planned_dates_editable_for_in_progress():
    wo = type(
        "WO",
        (),
        {
            "status": "in_progress",
            "planned_start_date": datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc),
            "planned_end_date": datetime(2026, 1, 2, 8, 0, tzinfo=timezone.utc),
        },
    )()
    _assert_work_order_planned_dates_unchanged_or_editable(
        wo,
        {"planned_start_date": datetime(2026, 2, 1, tzinfo=timezone.utc)},
    )


def test_assert_planned_dates_editable_for_released():
    same = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
    wo = type("WO", (), {"status": "released", "planned_start_date": same, "planned_end_date": same})()
    _assert_work_order_planned_dates_unchanged_or_editable(wo, {"planned_start_date": same})
    _assert_work_order_planned_dates_unchanged_or_editable(
        wo,
        {"planned_start_date": datetime(2026, 2, 1, tzinfo=timezone.utc)},
    )
