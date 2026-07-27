"""厂级工作时段 / 加班窗口单元测试"""

from datetime import date, datetime, time

from apps.kuaizhizao.utils.working_time import (
    WorkHoursConfig,
    add_working_hours,
    find_earliest_working_slot,
    find_latest_working_slot,
    is_within_working_hours,
    iter_work_windows,
    snap_to_working_start,
    subtract_working_hours,
)
from apps.kuaizhizao.utils.work_order_operation_scheduling import build_operation_time_slots
from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints


CFG = WorkHoursConfig(start=time(8, 0), end=time(17, 0))
CFG_BREAK = WorkHoursConfig(
    start=time(8, 0),
    end=time(17, 0),
    break_start=time(12, 0),
    break_end=time(13, 0),
)


def test_snap_from_evening_to_next_workday():
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}  # Sat/Sun
    # Friday 18:00 → Monday 08:00
    dt = datetime(2026, 7, 24, 18, 0, 0)
    snapped = snap_to_working_start(dt, holidays=holidays, config=CFG)
    assert snapped == datetime(2026, 7, 27, 8, 0, 0)


def test_add_working_hours_crosses_evening_and_weekend():
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    # Friday 16:00 + 3h → Mon 10:00 (1h Fri + 2h Mon)
    start = datetime(2026, 7, 24, 16, 0, 0)
    end = add_working_hours(start, 3.0, holidays=holidays, config=CFG)
    assert end == datetime(2026, 7, 27, 10, 0, 0)


def test_add_working_hours_skips_break():
    start = datetime(2026, 7, 27, 11, 0, 0)  # Mon
    end = add_working_hours(start, 2.0, holidays=set(), config=CFG_BREAK)
    # 11-12 (1h) + 13-14 (1h)
    assert end == datetime(2026, 7, 27, 14, 0, 0)


def test_subtract_working_hours_crosses_weekend():
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    end = datetime(2026, 7, 27, 10, 0, 0)  # Mon 10:00
    start = subtract_working_hours(end, 3.0, holidays=holidays, config=CFG)
    # 2h Mon morning (8-10) + 1h Fri (16-17)
    assert start == datetime(2026, 7, 24, 16, 0, 0)


def test_is_within_working_hours():
    assert is_within_working_hours(datetime(2026, 7, 27, 8, 0), config=CFG)
    assert is_within_working_hours(datetime(2026, 7, 27, 16, 59), config=CFG)
    assert not is_within_working_hours(datetime(2026, 7, 27, 17, 0), config=CFG)
    assert not is_within_working_hours(
        datetime(2026, 7, 25, 10, 0), holidays={date(2026, 7, 25)}, config=CFG
    )


def test_find_earliest_slot_avoids_station_overlap():
    holidays: set = set()
    intervals = [
        (datetime(2026, 7, 27, 8, 0), datetime(2026, 7, 27, 12, 0), 1),
    ]
    start, end = find_earliest_working_slot(
        intervals,
        datetime(2026, 7, 27, 8, 0),
        2.0,
        holidays=holidays,
        config=CFG,
        exclude_op_id=99,
    )
    assert start == datetime(2026, 7, 27, 12, 0)
    assert end == datetime(2026, 7, 27, 14, 0)


def test_find_earliest_slot_allows_parallel_capacity():
    holidays: set = set()
    intervals = [
        (datetime(2026, 7, 27, 8, 0), datetime(2026, 7, 27, 12, 0), 1),
    ]
    start, end = find_earliest_working_slot(
        intervals,
        datetime(2026, 7, 27, 8, 0),
        2.0,
        holidays=holidays,
        config=CFG,
        exclude_op_id=99,
        max_parallel=2,
    )
    assert start == datetime(2026, 7, 27, 8, 0)
    assert end == datetime(2026, 7, 27, 10, 0)


def test_changeover_gap_uses_net_working_hours():
    """跨产品换型：prev_end + changeover 净工时推后 earliest。"""
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    prev_end = datetime(2026, 7, 24, 16, 0)  # Fri 16:00
    ready = add_working_hours(prev_end, 2.0, holidays=holidays, config=CFG)
    # Fri 16-17 (1h) + Mon 08-09 (1h)
    assert ready == datetime(2026, 7, 27, 9, 0)
    # 同产品不插换型：earliest 可紧接 prev_end 的下一工作起点
    same_product_start = snap_to_working_start(prev_end, holidays=holidays, config=CFG)
    assert same_product_start == datetime(2026, 7, 24, 16, 0)


def test_find_latest_slot_before_due():
    holidays: set = set()
    start, end = find_latest_working_slot(
        [],
        datetime(2026, 7, 27, 17, 0),
        2.0,
        holidays=holidays,
        config=CFG,
    )
    assert end == datetime(2026, 7, 27, 17, 0)
    assert start == datetime(2026, 7, 27, 15, 0)


def test_shift_day_windows_override_base():
    day = date(2026, 7, 27)
    cfg = WorkHoursConfig(
        start=time(8, 0),
        end=time(17, 0),
        day_windows={day: [(time(6, 0), time(14, 0)), (time(14, 0), time(22, 0))]},
        window_source="shift",
    )
    windows = iter_work_windows(day, holidays=set(), config=cfg)
    assert windows == [
        (datetime(2026, 7, 27, 6, 0), datetime(2026, 7, 27, 22, 0)),
    ]


def test_build_slots_with_work_hours_forward():
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    slots = build_operation_time_slots(
        [10.0],  # > 9h/day → spans 2 workdays
        planned_start=datetime(2026, 7, 24, 8, 0),  # Fri
        holidays=holidays,
        work_hours=CFG,
    )
    assert len(slots) == 1
    assert slots[0][0] == datetime(2026, 7, 24, 8, 0)
    # Fri 9h + Mon 1h
    assert slots[0][1] == datetime(2026, 7, 27, 9, 0)


def test_scheduling_constraints_strips_legacy_work_hours():
    c = SchedulingConstraints(
        work_day_start="08:00",
        work_day_end="17:00",
        break_start="12:00",
        break_end="13:00",
        daily_capacity_hours=8.0,
        consider_human=True,
    )
    dumped = c.model_dump()
    assert "work_day_start" not in dumped
    assert "daily_capacity_hours" not in dumped
    assert dumped["consider_human"] is True


def test_workday_overtime_appends_evening_window():
    day = date(2026, 7, 27)  # Mon
    overtime = {day: [(time(18, 0), time(20, 0))]}
    windows = iter_work_windows(day, holidays=set(), config=CFG, overtime=overtime)
    assert windows == [
        (datetime(2026, 7, 27, 8, 0), datetime(2026, 7, 27, 17, 0)),
        (datetime(2026, 7, 27, 18, 0), datetime(2026, 7, 27, 20, 0)),
    ]
    assert is_within_working_hours(
        datetime(2026, 7, 27, 18, 30), holidays=set(), config=CFG, overtime=overtime
    )
    # 16:00 + 3h → 17:00 用完 1h，再进加班窗 18:00–20:00 用 2h → 20:00
    end = add_working_hours(
        datetime(2026, 7, 27, 16, 0),
        3.0,
        holidays=set(),
        config=CFG,
        overtime=overtime,
    )
    assert end == datetime(2026, 7, 27, 20, 0)


def test_holiday_overtime_only_opens_overtime_window():
    sat = date(2026, 7, 25)
    holidays = {sat}
    overtime = {sat: [(time(8, 0), time(12, 0))]}
    assert iter_work_windows(sat, holidays=holidays, config=CFG) == []
    windows = iter_work_windows(sat, holidays=holidays, config=CFG, overtime=overtime)
    assert windows == [
        (datetime(2026, 7, 25, 8, 0), datetime(2026, 7, 25, 12, 0)),
    ]
    # 节假日无加班不可排；有加班可从加班窗开始
    snapped = snap_to_working_start(
        datetime(2026, 7, 24, 18, 0),
        holidays=holidays | {date(2026, 7, 26)},
        config=CFG,
        overtime=overtime,
    )
    assert snapped == datetime(2026, 7, 25, 8, 0)


def test_holiday_without_overtime_not_schedulable():
    sat = date(2026, 7, 25)
    holidays = {sat, date(2026, 7, 26)}
    assert not is_within_working_hours(
        datetime(2026, 7, 25, 10, 0), holidays=holidays, config=CFG, overtime={}
    )
    start, end = find_earliest_working_slot(
        [],
        datetime(2026, 7, 24, 18, 0),
        2.0,
        holidays=holidays,
        config=CFG,
        overtime={sat: [(time(8, 0), time(12, 0))]},
    )
    assert start == datetime(2026, 7, 25, 8, 0)
    assert end == datetime(2026, 7, 25, 10, 0)


def test_fifty_hours_spans_multiple_workdays():
    """50h 净工时不应等于 50 墙钟小时。"""
    holidays = {
        date(2026, 7, 25),
        date(2026, 7, 26),
        date(2026, 8, 1),
        date(2026, 8, 2),
    }
    start = datetime(2026, 7, 27, 8, 0)  # Mon
    end = add_working_hours(start, 50.0, holidays=holidays, config=CFG)
    # 9h/day → Mon–Fri 45h，剩余 5h → 下周一 13:00
    assert end == datetime(2026, 8, 3, 13, 0, 0)
    assert (end - start).total_seconds() / 3600 > 50
