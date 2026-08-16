"""可视排产校验：业务墙钟与 ORM UTC 必须可比较。"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from apps.kuaizhizao.services.visual_scheduling_service import (
    _intervals_overlap,
    _operation_start_before_prev_start,
    _parse_dt,
)
from core.utils.timezone_utils import coerce_business_datetime_to_utc, site_timezone_name


def test_parse_dt_wall_clock_becomes_utc_aware():
    parsed = _parse_dt("2026-09-14 14:00:00")
    assert parsed is not None
    assert parsed.tzinfo is not None
    expected = coerce_business_datetime_to_utc(datetime(2026, 9, 14, 14, 0, 0))
    assert parsed == expected


def test_parse_dt_iso_z_stays_same_instant():
    parsed = _parse_dt("2026-09-14T06:00:00Z")
    assert parsed == datetime(2026, 9, 14, 6, 0, tzinfo=timezone.utc)


def test_intervals_overlap_wall_clock_vs_orm_utc():
    """补充排产提交墙钟字符串，库内工序是 UTC aware，比较不得再抛 TypeError。"""
    site_start = datetime(2026, 9, 14, 14, 0, 0)
    site_end = datetime(2026, 9, 14, 15, 0, 0)
    orm_start = coerce_business_datetime_to_utc(site_start)
    orm_end = coerce_business_datetime_to_utc(site_end)
    assert _intervals_overlap("2026-09-14 14:00:00", "2026-09-14 15:00:00", orm_start, orm_end)
    assert _intervals_overlap(site_start, site_end, orm_start, orm_end)
    later_orm_start = coerce_business_datetime_to_utc(datetime(2026, 9, 14, 16, 0, 0))
    later_orm_end = coerce_business_datetime_to_utc(datetime(2026, 9, 14, 17, 0, 0))
    assert not _intervals_overlap(site_start, site_end, later_orm_start, later_orm_end)


def test_operation_start_before_prev_mixed_tz():
    wall = datetime(2026, 9, 14, 14, 0, 0)
    prev_utc = coerce_business_datetime_to_utc(datetime(2026, 9, 14, 15, 0, 0))
    assert _operation_start_before_prev_start(wall, prev_utc) is True
    same_instant = coerce_business_datetime_to_utc(wall)
    assert _operation_start_before_prev_start(wall, same_instant) is False


def test_parse_dt_site_aware_converts_to_utc():
    site = datetime(2026, 9, 14, 14, 0, tzinfo=ZoneInfo(site_timezone_name()))
    parsed = _parse_dt(site)
    assert parsed == coerce_business_datetime_to_utc(datetime(2026, 9, 14, 14, 0, 0))
