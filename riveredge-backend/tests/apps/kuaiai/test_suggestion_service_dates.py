"""Pulse 建议日期计算单元测试。"""

from __future__ import annotations

from datetime import date, datetime, timezone

from apps.kuaiai.services.suggestion_service import _as_site_date, _delay_days, _site_today


def test_delay_days_accepts_datetime_planned_end():
    today = date(2026, 8, 4)
    planned = datetime(2026, 8, 1, 16, 0, 0, tzinfo=timezone.utc)
    days = _delay_days(planned, today=today)
    assert days is not None
    assert days >= 2


def test_as_site_date_from_date():
    assert _as_site_date(date(2026, 1, 2)) == date(2026, 1, 2)


def test_site_today_returns_date():
    assert isinstance(_site_today(), date)
