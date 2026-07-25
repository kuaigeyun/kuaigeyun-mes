"""工作日历单元测试"""

from datetime import date, timedelta

from apps.kuaizhizao.utils.work_calendar import (
    add_workdays,
    subtract_workdays,
    workdays_between,
)


def test_subtract_workdays_skips_holidays():
    start = date(2026, 7, 27)  # Mon
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}  # Sat/Sun as holidays
    # 回退 1 个工作日：跳过周末 → 7/24 Fri
    assert subtract_workdays(start, 1, holidays) == date(2026, 7, 24)


def test_add_workdays_skips_holidays():
    start = date(2026, 7, 24)  # Fri
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    assert add_workdays(start, 1, holidays) == date(2026, 7, 27)


def test_workdays_between():
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    assert workdays_between(date(2026, 7, 24), date(2026, 7, 28), holidays) == 2
