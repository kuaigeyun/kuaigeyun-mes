"""scheduling_freeze 单元测试。"""

from datetime import datetime

from apps.kuaizhizao.services.scheduling_freeze import (
    freeze_anchor_datetime,
    is_planned_start_in_freeze_window,
    work_order_is_scheduling_locked,
)


class _Wo:
    def __init__(self, *, is_frozen=False, planned_start_date=None):
        self.is_frozen = is_frozen
        self.planned_start_date = planned_start_date


def test_freeze_anchor_end_of_day():
    now = datetime(2026, 6, 4, 10, 0, 0)
    anchor = freeze_anchor_datetime(2, now=now)
    assert anchor.day == 6
    assert anchor.hour == 23


def test_planned_start_in_freeze_window():
    now = datetime(2026, 6, 4, 10, 0, 0)
    assert is_planned_start_in_freeze_window(datetime(2026, 6, 5, 8, 0, 0), 2, now=now)
    assert not is_planned_start_in_freeze_window(datetime(2026, 6, 10, 8, 0, 0), 2, now=now)


def test_work_order_frozen_lock():
    wo = _Wo(is_frozen=True, planned_start_date=datetime(2026, 6, 10))
    assert work_order_is_scheduling_locked(wo, 2)
