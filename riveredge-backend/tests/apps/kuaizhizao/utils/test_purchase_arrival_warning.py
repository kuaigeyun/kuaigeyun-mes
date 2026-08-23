"""采购到货预警等级计算单元测试。"""

from datetime import date

from apps.kuaizhizao.utils.purchase_arrival_warning import (
    WARNING_LEVEL_IMMINENT,
    WARNING_LEVEL_NORMAL,
    WARNING_LEVEL_OVERDUE,
    compute_day_offset,
    compute_warning_level,
    enrich_line_warning_fields,
)


def test_compute_warning_level_overdue():
    today = date(2026, 8, 23)
    assert compute_warning_level(date(2026, 8, 22), today, imminent_days=3) == WARNING_LEVEL_OVERDUE


def test_compute_warning_level_imminent():
    today = date(2026, 8, 23)
    assert compute_warning_level(date(2026, 8, 25), today, imminent_days=3) == WARNING_LEVEL_IMMINENT
    assert compute_warning_level(today, today, imminent_days=3) == WARNING_LEVEL_IMMINENT


def test_compute_warning_level_normal():
    today = date(2026, 8, 23)
    assert compute_warning_level(date(2026, 8, 30), today, imminent_days=3) == WARNING_LEVEL_NORMAL


def test_compute_warning_level_no_open_qty():
    today = date(2026, 8, 23)
    assert compute_warning_level(date(2026, 8, 1), today, has_open_qty=False) is None


def test_compute_day_offset():
    today = date(2026, 8, 23)
    assert compute_day_offset(date(2026, 8, 26), today) == 3
    assert compute_day_offset(date(2026, 8, 20), today) == -3


def test_enrich_line_warning_fields():
    today = date(2026, 8, 23)
    row = {"required_date": date(2026, 8, 20), "outstanding_quantity": 5}
    enrich_line_warning_fields(row, site_today=today, imminent_days=3)
    assert row["warning_level"] == WARNING_LEVEL_OVERDUE
    assert row["overdue_days"] == 3
    assert row["remaining_days"] == 0
    assert row["is_overdue"] is True
