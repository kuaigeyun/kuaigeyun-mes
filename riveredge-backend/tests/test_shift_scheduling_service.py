"""排班服务单元测试（不依赖数据库）"""

from datetime import date

import pytest

from apps.master_data.services.shift_scheduling_service import week_bounds
from infra.exceptions.exceptions import ValidationError


class TestWeekBounds:
    def test_monday_anchor(self):
        # 2026-06-03 is Wednesday
        start, end = week_bounds(date(2026, 6, 3))
        assert start == date(2026, 6, 1)
        assert end == date(2026, 6, 7)

    def test_sunday_anchor(self):
        start, end = week_bounds(date(2026, 6, 7))
        assert start == date(2026, 6, 1)
        assert end == date(2026, 6, 7)

    def test_monday_stays_same_week(self):
        start, end = week_bounds(date(2026, 6, 1))
        assert start == date(2026, 6, 1)
        assert end == date(2026, 6, 7)


def test_validation_error_is_distinct():
    with pytest.raises(ValidationError):
        raise ValidationError("班次编码 DUP 已存在")
