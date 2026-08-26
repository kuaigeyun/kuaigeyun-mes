"""客户跟进销售中心 KPI 统计逻辑测试。"""

from __future__ import annotations

from datetime import datetime, timezone

from apps.kuaizhizao.utils.customer_follow_up_plan import follow_up_plan_flags
from core.utils.timezone_utils import to_site_date


def _utc(y, m, d, h=0, mi=0) -> datetime:
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


def test_follow_up_plan_flags_pending_and_overdue():
    now = _utc(2026, 8, 26, 10, 0)
    now_date = to_site_date(now)

    pending, overdue = follow_up_plan_flags(
        _utc(2026, 8, 25, 0, 0),
        now=now,
        now_date=now_date,
    )
    assert pending is True
    assert overdue is True


def test_follow_up_plan_flags_same_day_future_time_pending_only():
    now = _utc(2026, 8, 26, 2, 0)
    now_date = to_site_date(now)

    pending, overdue = follow_up_plan_flags(
        _utc(2026, 8, 26, 8, 0),
        now=now,
        now_date=now_date,
    )
    assert pending is True
    assert overdue is False


def test_follow_up_plan_flags_no_next():
    now = _utc(2026, 8, 26, 10, 0)
    now_date = to_site_date(now)

    pending, overdue = follow_up_plan_flags(
        None,
        now=now,
        now_date=now_date,
    )
    assert pending is False
    assert overdue is False
