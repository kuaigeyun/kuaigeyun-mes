"""换型辅助逻辑单元测试（不依赖 DB）。"""

from datetime import datetime, time

from apps.kuaizhizao.services.scheduling_engine.greedy_rules_engine import (
    _apply_changeover_earliest,
    _prev_interval,
)
from apps.kuaizhizao.utils.working_time import WorkHoursConfig


CFG = WorkHoursConfig(start=time(8, 0), end=time(17, 0))


def test_prev_interval_picks_latest_ending_before():
    timeline = [
        (datetime(2026, 7, 27, 8, 0), datetime(2026, 7, 27, 10, 0), 1, 100),
        (datetime(2026, 7, 27, 10, 0), datetime(2026, 7, 27, 12, 0), 2, 200),
    ]
    prev = _prev_interval(timeline, datetime(2026, 7, 27, 11, 0))
    assert prev is not None
    assert prev[2] == 1


def test_apply_changeover_same_product_no_bump():
    timeline = [
        (datetime(2026, 7, 27, 8, 0), datetime(2026, 7, 27, 10, 0), 1, 100),
    ]
    earliest = _apply_changeover_earliest(
        timeline,
        datetime(2026, 7, 27, 10, 0),
        product_id=100,
        changeover_hours=2.0,
        holidays=set(),
        work_hours=CFG,
        overtime=None,
    )
    assert earliest == datetime(2026, 7, 27, 10, 0)


def test_apply_changeover_different_product_bumps():
    timeline = [
        (datetime(2026, 7, 27, 8, 0), datetime(2026, 7, 27, 10, 0), 1, 100),
    ]
    earliest = _apply_changeover_earliest(
        timeline,
        datetime(2026, 7, 27, 10, 0),
        product_id=200,
        changeover_hours=2.0,
        holidays=set(),
        work_hours=CFG,
        overtime=None,
    )
    assert earliest == datetime(2026, 7, 27, 12, 0)
