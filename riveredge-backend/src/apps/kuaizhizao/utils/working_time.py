"""
厂级工作时段：在工作日 + 每日工作窗口（含加班）内累加净工时，得到墙钟起止。

节假日、工作时段、加班窗口唯一真源：绩效工作日历（WorkCalendarService）。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from apps.kuaizhizao.utils.work_calendar import is_workday


DEFAULT_WORK_DAY_START = "08:00"
DEFAULT_WORK_DAY_END = "17:00"

# overtime_date -> [(start_time, end_time), ...]
OvertimeByDate = Dict[date, List[Tuple[time, time]]]


def _naive_time(value: time) -> time:
    """Tortoise TimeField 在 USE_TZ 下可能带 tzinfo；排产一律用朴素时刻。"""
    if getattr(value, "tzinfo", None) is not None:
        return value.replace(tzinfo=None, microsecond=0)
    if getattr(value, "microsecond", 0):
        return value.replace(microsecond=0)
    return value


def _parse_hhmm(value: Any, *, default: Optional[str] = None) -> Optional[time]:
    raw = value if value not in (None, "") else default
    if raw is None or raw == "":
        return None
    if isinstance(raw, time):
        return _naive_time(raw)
    text = str(raw).strip()
    if not text:
        return None
    parts = text.split(":")
    if len(parts) < 2:
        raise ValueError(f"无效时间格式: {raw!r}，期望 HH:MM")
    hour = int(parts[0])
    minute = int(parts[1])
    second = int(parts[2]) if len(parts) > 2 else 0
    return time(hour, minute, second)


def _combine(day: date, t: time, tzinfo: Any = None) -> datetime:
    dt = datetime.combine(day, t)
    if tzinfo is not None:
        return dt.replace(tzinfo=tzinfo)
    return dt


def _with_tz(template: datetime, day: date, t: time) -> datetime:
    return _combine(day, t, getattr(template, "tzinfo", None))


def _merge_windows(
    windows: List[Tuple[datetime, datetime]],
) -> List[Tuple[datetime, datetime]]:
    if not windows:
        return []
    ordered = sorted(windows, key=lambda x: x[0])
    merged: List[Tuple[datetime, datetime]] = [ordered[0]]
    for start, end in ordered[1:]:
        last_s, last_e = merged[-1]
        if start <= last_e:
            merged[-1] = (last_s, max(last_e, end))
        else:
            merged.append((start, end))
    return merged


@dataclass(frozen=True)
class WorkHoursConfig:
    """每日基础可排时段（不跨日）。"""

    start: time
    end: time
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    # 班次模式：按日覆盖基础窗；键缺失表示该日无固定/班次基础窗（仅加班）
    day_windows: Optional[Dict[date, List[Tuple[time, time]]]] = None
    window_source: str = "fixed"

    @classmethod
    def defaults(cls) -> "WorkHoursConfig":
        return cls(
            start=_parse_hhmm(DEFAULT_WORK_DAY_START) or time(8, 0),
            end=_parse_hhmm(DEFAULT_WORK_DAY_END) or time(17, 0),
        )

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "WorkHoursConfig":
        payload = data or {}
        start = _parse_hhmm(payload.get("work_day_start"), default=DEFAULT_WORK_DAY_START)
        end = _parse_hhmm(payload.get("work_day_end"), default=DEFAULT_WORK_DAY_END)
        if start is None or end is None:
            return cls.defaults()
        break_start = _parse_hhmm(payload.get("break_start"))
        break_end = _parse_hhmm(payload.get("break_end"))
        cfg = cls(start=start, end=end, break_start=break_start, break_end=break_end)
        cfg.validate()
        return cfg

    @classmethod
    def from_model(
        cls,
        row: Any,
        *,
        day_windows: Optional[Dict[date, List[Tuple[time, time]]]] = None,
    ) -> "WorkHoursConfig":
        bs = getattr(row, "break_start", None)
        be = getattr(row, "break_end", None)
        source = str(getattr(row, "window_source", None) or "fixed").strip().lower()
        cfg = cls(
            start=_naive_time(row.work_day_start),
            end=_naive_time(row.work_day_end),
            break_start=_naive_time(bs) if bs is not None else None,
            break_end=_naive_time(be) if be is not None else None,
            day_windows=day_windows if source == "shift" else None,
            window_source=source if source in {"fixed", "shift"} else "fixed",
        )
        cfg.validate()
        return cfg

    def validate(self) -> None:
        if self.end <= self.start:
            raise ValueError("work_day_end 必须晚于 work_day_start")
        has_bs = self.break_start is not None
        has_be = self.break_end is not None
        if has_bs != has_be:
            raise ValueError("休息时段须同时配置 break_start 与 break_end")
        if has_bs and has_be:
            assert self.break_start is not None and self.break_end is not None
            if not (self.start <= self.break_start < self.break_end <= self.end):
                raise ValueError("休息时段须落在工作时段内，且 break_end > break_start")

    def daily_net_hours(self) -> float:
        total = (
            datetime.combine(date.min, self.end) - datetime.combine(date.min, self.start)
        ).total_seconds() / 3600.0
        if self.break_start is not None and self.break_end is not None:
            br = (
                datetime.combine(date.min, self.break_end)
                - datetime.combine(date.min, self.break_start)
            ).total_seconds() / 3600.0
            total -= br
        return max(0.0, total)

    def base_windows_for_day(
        self, day: date, *, tzinfo: Any = None
    ) -> List[Tuple[datetime, datetime]]:
        if self.day_windows is not None:
            slots = self.day_windows.get(day) or []
            out: List[Tuple[datetime, datetime]] = []
            for start_t, end_t in slots:
                start_t = _naive_time(start_t) if isinstance(start_t, time) else start_t
                end_t = _naive_time(end_t) if isinstance(end_t, time) else end_t
                if end_t <= start_t:
                    continue
                out.append((_combine(day, start_t, tzinfo), _combine(day, end_t, tzinfo)))
            return out
        day_start = _combine(day, self.start, tzinfo)
        day_end = _combine(day, self.end, tzinfo)
        if self.break_start is None or self.break_end is None:
            return [(day_start, day_end)]
        b0 = _combine(day, self.break_start, tzinfo)
        b1 = _combine(day, self.break_end, tzinfo)
        windows: List[Tuple[datetime, datetime]] = []
        if b0 > day_start:
            windows.append((day_start, b0))
        if b1 < day_end:
            windows.append((b1, day_end))
        return windows


async def _load_shift_day_windows(
    tenant_id: int,
    from_date: date,
    to_date: date,
) -> Dict[date, List[Tuple[time, time]]]:
    """已发布排班：按日合并班次时刻为厂级基础窗。"""
    from apps.master_data.models.shift_scheduling import Shift, ShiftAssignment, ShiftRoster

    rosters = await ShiftRoster.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        status="published",
        period_start__lte=to_date,
        period_end__gte=from_date,
    ).all()
    if not rosters:
        return {}
    roster_ids = [int(r.id) for r in rosters]
    assignments = await ShiftAssignment.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        roster_id__in=roster_ids,
        work_date__gte=from_date,
        work_date__lte=to_date,
        shift_id__isnull=False,
    ).all()
    shift_ids = sorted({int(a.shift_id) for a in assignments if a.shift_id})
    if not shift_ids:
        return {}
    shifts = await Shift.filter(
        tenant_id=tenant_id, id__in=shift_ids, deleted_at__isnull=True, is_active=True
    ).all()
    shift_times = {
        int(s.id): (_naive_time(s.start_time), _naive_time(s.end_time)) for s in shifts
    }
    by_day: Dict[date, List[Tuple[time, time]]] = {}
    for a in assignments:
        times = shift_times.get(int(a.shift_id or 0))
        if not times:
            continue
        by_day.setdefault(a.work_date, []).append(times)
    merged: Dict[date, List[Tuple[time, time]]] = {}
    for day, slots in by_day.items():
        ordered = sorted(slots, key=lambda x: x[0])
        day_merged: List[Tuple[time, time]] = [ordered[0]]
        for start_t, end_t in ordered[1:]:
            last_s, last_e = day_merged[-1]
            if start_t <= last_e:
                day_merged[-1] = (last_s, max(last_e, end_t))
            else:
                day_merged.append((start_t, end_t))
        merged[day] = day_merged
    return merged


async def load_scheduling_work_context(
    tenant_id: int,
    *,
    around: Optional[date] = None,
    span_days: int = 180,
) -> Tuple[Set[date], "WorkHoursConfig", OvertimeByDate]:
    """加载排产用节假日、厂级工作时段与加班窗口。"""
    from apps.master_data.services.work_calendar_service import WorkCalendarService

    center = around or date.today()
    from_date = center - timedelta(days=span_days)
    to_date = center + timedelta(days=span_days)
    cfg_row, holidays, overtime = await WorkCalendarService.get_effective_calendar(
        tenant_id, from_date, to_date
    )
    day_windows = None
    if str(getattr(cfg_row, "window_source", "fixed") or "fixed").strip().lower() == "shift":
        day_windows = await _load_shift_day_windows(tenant_id, from_date, to_date)
    return holidays, WorkHoursConfig.from_model(cfg_row, day_windows=day_windows), overtime


def iter_work_windows(
    day: date,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    tzinfo: Any = None,
) -> List[Tuple[datetime, datetime]]:
    """
    返回某日可排窗口：
    - 工作日：基础窗口 + 加班窗口（合并重叠）
    - 节假日/非工作日：仅加班窗口（有则开放）
    """
    cfg = config or WorkHoursConfig.defaults()
    ot_windows: List[Tuple[datetime, datetime]] = []
    for start_t, end_t in (overtime or {}).get(day, []) or []:
        start_t = _naive_time(start_t) if isinstance(start_t, time) else start_t
        end_t = _naive_time(end_t) if isinstance(end_t, time) else end_t
        if end_t <= start_t:
            continue
        ot_windows.append((_combine(day, start_t, tzinfo), _combine(day, end_t, tzinfo)))

    if is_workday(day, holidays):
        return _merge_windows(cfg.base_windows_for_day(day, tzinfo=tzinfo) + ot_windows)
    return _merge_windows(ot_windows)


def is_within_working_hours(
    dt: datetime,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
) -> bool:
    """开工时刻是否落在某工作窗口内（含起点，不含终点）。"""
    cfg = config or WorkHoursConfig.defaults()
    for start, end in iter_work_windows(
        dt.date(),
        holidays=holidays,
        config=cfg,
        overtime=overtime,
        tzinfo=dt.tzinfo,
    ):
        if start <= dt < end:
            return True
    return False


def snap_to_working_start(
    dt: datetime,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    max_scan_days: int = 3660,
) -> datetime:
    """若已在工作窗口内则原样返回；否则推到下一工作窗口起点。"""
    cfg = config or WorkHoursConfig.defaults()
    cursor_day = dt.date()
    for offset in range(max_scan_days + 1):
        day = cursor_day + timedelta(days=offset)
        windows = iter_work_windows(
            day,
            holidays=holidays,
            config=cfg,
            overtime=overtime,
            tzinfo=dt.tzinfo,
        )
        for start, end in windows:
            if offset == 0:
                if dt < start:
                    return start
                if start <= dt < end:
                    return dt
                continue
            return start
    raise ValueError(f"自 {dt} 起 {max_scan_days} 天内未找到工作时段")


def add_working_hours(
    start_dt: datetime,
    hours: float,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    max_scan_days: int = 3660,
) -> datetime:
    """从 start_dt（先 snap）起消耗净工时 hours，返回墙钟结束时刻。"""
    cfg = config or WorkHoursConfig.defaults()
    remaining = float(hours or 0.0)
    if remaining <= 0:
        return snap_to_working_start(
            start_dt, holidays=holidays, config=cfg, overtime=overtime
        )

    cursor = snap_to_working_start(
        start_dt, holidays=holidays, config=cfg, overtime=overtime
    )
    for _ in range(max_scan_days * 4 + 1):
        windows = iter_work_windows(
            cursor.date(),
            holidays=holidays,
            config=cfg,
            overtime=overtime,
            tzinfo=cursor.tzinfo,
        )
        placed = False
        for win_start, win_end in windows:
            if cursor >= win_end:
                continue
            seg_start = max(cursor, win_start)
            if seg_start >= win_end:
                continue
            available = (win_end - seg_start).total_seconds() / 3600.0
            if remaining <= available + 1e-9:
                return seg_start + timedelta(hours=remaining)
            remaining -= available
            cursor = win_end
            placed = True
        # 当日窗口耗尽 → 下一自然日再 snap（含加班日）
        next_day = cursor.date() + timedelta(days=1)
        cursor = _with_tz(cursor, next_day, time(0, 0))
        cursor = snap_to_working_start(
            cursor, holidays=holidays, config=cfg, overtime=overtime
        )
        if not placed and remaining <= 0:
            break
    raise ValueError(f"无法在 {max_scan_days} 天内安排 {hours} 小时工作时间")


def subtract_working_hours(
    end_dt: datetime,
    hours: float,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    max_scan_days: int = 3660,
) -> datetime:
    """自 end_dt 向前回退净工时 hours，返回墙钟开始时刻。"""
    cfg = config or WorkHoursConfig.defaults()
    remaining = float(hours or 0.0)
    if remaining <= 0:
        return end_dt

    cursor = end_dt
    if not is_within_working_hours(
        cursor, holidays=holidays, config=cfg, overtime=overtime
    ) and not any(
        s < cursor <= e
        for s, e in iter_work_windows(
            cursor.date(),
            holidays=holidays,
            config=cfg,
            overtime=overtime,
            tzinfo=cursor.tzinfo,
        )
    ):
        cursor = _snap_to_previous_working_end(
            cursor,
            holidays=holidays,
            config=cfg,
            overtime=overtime,
            max_scan_days=max_scan_days,
        )

    for _ in range(max_scan_days * 4 + 1):
        windows = list(
            reversed(
                iter_work_windows(
                    cursor.date(),
                    holidays=holidays,
                    config=cfg,
                    overtime=overtime,
                    tzinfo=cursor.tzinfo,
                )
            )
        )
        moved = False
        for win_start, win_end in windows:
            if cursor <= win_start:
                continue
            seg_end = min(cursor, win_end)
            if seg_end <= win_start:
                continue
            available = (seg_end - win_start).total_seconds() / 3600.0
            if remaining <= available + 1e-9:
                return seg_end - timedelta(hours=remaining)
            remaining -= available
            cursor = win_start
            moved = True
        if not moved:
            prev_day = cursor.date() - timedelta(days=1)
            cursor = _with_tz(cursor, prev_day, time(23, 59, 59))
            cursor = _snap_to_previous_working_end(
                cursor,
                holidays=holidays,
                config=cfg,
                overtime=overtime,
                max_scan_days=max_scan_days,
            )
    raise ValueError(f"无法在 {max_scan_days} 天内回退 {hours} 小时工作时间")


def snap_to_previous_working_end(
    dt: datetime,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    max_scan_days: int = 3660,
) -> datetime:
    """若已在窗口终点或窗口内则收到不晚于 dt 的窗口内点；否则推到上一工作窗口终点。"""
    cfg = config or WorkHoursConfig.defaults()
    return _snap_to_previous_working_end(
        dt,
        holidays=holidays,
        config=cfg,
        overtime=overtime,
        max_scan_days=max_scan_days,
    )


def _snap_to_previous_working_end(
    dt: datetime,
    *,
    holidays: Optional[Set[date]] = None,
    config: WorkHoursConfig,
    overtime: Optional[OvertimeByDate] = None,
    max_scan_days: int,
) -> datetime:
    for offset in range(max_scan_days + 1):
        day = dt.date() - timedelta(days=offset)
        windows = iter_work_windows(
            day,
            holidays=holidays,
            config=config,
            overtime=overtime,
            tzinfo=dt.tzinfo,
        )
        if not windows:
            continue
        if offset == 0:
            for start, end in reversed(windows):
                if dt > start:
                    return min(dt, end)
            continue
        return windows[-1][1]
    raise ValueError(f"自 {dt} 向前 {max_scan_days} 天内未找到工作时段")


def _intervals_overlap(s1: datetime, e1: datetime, s2: datetime, e2: datetime) -> bool:
    return s1 < e2 and s2 < e1


def find_earliest_working_slot(
    intervals: List[Tuple[datetime, datetime, int]],
    earliest: datetime,
    duration_hours: float,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    exclude_op_id: int = 0,
    max_parallel: int = 1,
    max_attempts: int = 500,
) -> Tuple[datetime, datetime]:
    """
    在工位占用时间线（墙钟）上，找最早可放置净工时 duration_hours 的墙钟 [start, end]。
    max_parallel>1 时允许同刻最多 N 条重叠占用。
    """
    cfg = config or WorkHoursConfig.defaults()
    capacity = max(1, int(max_parallel or 1))
    sorted_iv = sorted(
        [(s, e) for s, e, oid in intervals if oid != exclude_op_id],
        key=lambda x: x[0],
    )
    cursor = earliest
    for _ in range(max_attempts):
        start = snap_to_working_start(
            cursor, holidays=holidays, config=cfg, overtime=overtime
        )
        end = add_working_hours(
            start,
            duration_hours,
            holidays=holidays,
            config=cfg,
            overtime=overtime,
        )
        overlapping = [(s, e) for s, e in sorted_iv if _intervals_overlap(start, end, s, e)]
        if len(overlapping) < capacity:
            return start, end
        cursor = min(e for _, e in overlapping)
    raise ValueError("无法找到不冲突的工作时段槽位")


def find_latest_working_slot(
    intervals: List[Tuple[datetime, datetime, int]],
    latest: datetime,
    duration_hours: float,
    *,
    holidays: Optional[Set[date]] = None,
    config: Optional[WorkHoursConfig] = None,
    overtime: Optional[OvertimeByDate] = None,
    exclude_op_id: int = 0,
    max_parallel: int = 1,
    max_attempts: int = 500,
) -> Tuple[datetime, datetime]:
    """
    自 latest 向前，找最晚可放置净工时 duration_hours 的墙钟 [start, end]（end <= latest）。
    """
    cfg = config or WorkHoursConfig.defaults()
    capacity = max(1, int(max_parallel or 1))
    sorted_iv = sorted(
        [(s, e) for s, e, oid in intervals if oid != exclude_op_id],
        key=lambda x: x[0],
    )
    cursor = latest
    for _ in range(max_attempts):
        end = snap_to_previous_working_end(
            cursor, holidays=holidays, config=cfg, overtime=overtime
        )
        start = subtract_working_hours(
            end,
            duration_hours,
            holidays=holidays,
            config=cfg,
            overtime=overtime,
        )
        overlapping = [(s, e) for s, e in sorted_iv if _intervals_overlap(start, end, s, e)]
        if len(overlapping) < capacity:
            return start, end
        # 向前避开：推到重叠区间最早起点之前
        cursor = min(s for s, _ in overlapping)
    raise ValueError("无法找到不冲突的倒排工作时段槽位")
