/**
 * 将绩效有效日历转为甘特「不可排」时间带（与后端 iter_work_windows 语义对齐）。
 */

import dayjs, { Dayjs } from 'dayjs';

export type EffectiveWorkCalendar = {
  config: {
    workDayStart: string;
    workDayEnd: string;
    breakStart?: string | null;
    breakEnd?: string | null;
    windowSource?: 'fixed' | 'shift';
  };
  holidayDates: string[];
  overtimeByDate: Record<string, Array<{ startTime: string; endTime: string }>>;
  dayWindowsByDate?: Record<string, Array<{ startTime: string; endTime: string }>>;
};

export type TimeBand = {
  start: Date;
  end: Date;
  title?: string;
};

function parseHm(raw: string | null | undefined): { h: number; m: number } | null {
  if (!raw) return null;
  const parts = String(raw).trim().slice(0, 5).split(':');
  if (parts.length < 2) return null;
  return { h: Number(parts[0]), m: Number(parts[1]) };
}

function atTime(day: Dayjs, hm: { h: number; m: number }): Dayjs {
  return day.hour(hm.h).minute(hm.m).second(0).millisecond(0);
}

type Window = [Dayjs, Dayjs];

function mergeWindows(windows: Window[]): Window[] {
  if (windows.length === 0) return [];
  const ordered = [...windows].sort((a, b) => a[0].valueOf() - b[0].valueOf());
  const merged: Window[] = [ordered[0]];
  for (let i = 1; i < ordered.length; i++) {
    const [s, e] = ordered[i];
    const last = merged[merged.length - 1];
    if (s.valueOf() <= last[1].valueOf()) {
      if (e.valueOf() > last[1].valueOf()) last[1] = e;
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

function workWindowsForDay(day: Dayjs, calendar: EffectiveWorkCalendar): Window[] {
  const key = day.format('YYYY-MM-DD');
  const holidays = new Set(calendar.holidayDates.map((d) => d.slice(0, 10)));
  const isHoliday = holidays.has(key);
  const ot = calendar.overtimeByDate[key] || [];
  const otWindows: Window[] = [];
  for (const w of ot) {
    const a = parseHm(w.startTime);
    const b = parseHm(w.endTime);
    if (!a || !b) continue;
    const s = atTime(day, a);
    const e = atTime(day, b);
    if (e.isAfter(s)) otWindows.push([s, e]);
  }

  if (isHoliday) {
    return mergeWindows(otWindows);
  }

  const base: Window[] = [];
  const shiftSlots =
    calendar.config.windowSource === 'shift' ? calendar.dayWindowsByDate?.[key] || [] : null;
  if (shiftSlots) {
    for (const w of shiftSlots) {
      const a = parseHm(w.startTime);
      const b = parseHm(w.endTime);
      if (!a || !b) continue;
      const s = atTime(day, a);
      const e = atTime(day, b);
      if (e.isAfter(s)) base.push([s, e]);
    }
  } else {
    const start = parseHm(calendar.config.workDayStart) || { h: 8, m: 0 };
    const end = parseHm(calendar.config.workDayEnd) || { h: 17, m: 0 };
    const bs = parseHm(calendar.config.breakStart);
    const be = parseHm(calendar.config.breakEnd);
    const dayStart = atTime(day, start);
    const dayEnd = atTime(day, end);
    if (bs && be) {
      const b0 = atTime(day, bs);
      const b1 = atTime(day, be);
      if (b0.isAfter(dayStart)) base.push([dayStart, b0]);
      if (b1.isBefore(dayEnd)) base.push([b1, dayEnd]);
    } else {
      base.push([dayStart, dayEnd]);
    }
  }
  return mergeWindows([...base, ...otWindows]);
}

function invertDayWindows(day: Dayjs, work: Window[]): Window[] {
  const dayStart = day.startOf('day');
  const dayEnd = day.endOf('day').add(1, 'millisecond'); // exclusive next midnight
  const endExclusive = day.add(1, 'day').startOf('day');
  if (work.length === 0) {
    return [[dayStart, endExclusive]];
  }
  const nonWork: Window[] = [];
  let cursor = dayStart;
  for (const [s, e] of work) {
    if (s.isAfter(cursor)) nonWork.push([cursor, s]);
    if (e.isAfter(cursor)) cursor = e;
  }
  if (cursor.isBefore(endExclusive)) nonWork.push([cursor, endExclusive]);
  void dayEnd;
  return nonWork;
}

/**
 * @param density day=细段；week=细段；month=仅整日不可排（无加班节假日）
 */
export function buildNonWorkTimeBands(
  rangeStart: Date,
  rangeEnd: Date,
  calendar: EffectiveWorkCalendar,
  density: 'day' | 'week' | 'month' = 'week',
): TimeBand[] {
  const bands: TimeBand[] = [];
  let cursor = dayjs(rangeStart).startOf('day');
  const end = dayjs(rangeEnd);
  const holidays = new Set(calendar.holidayDates.map((d) => d.slice(0, 10)));

  while (cursor.isBefore(end)) {
    const key = cursor.format('YYYY-MM-DD');
    const work = workWindowsForDay(cursor, calendar);

    if (density === 'month') {
      const isHoliday = holidays.has(key);
      const hasOt = (calendar.overtimeByDate[key] || []).length > 0;
      if (isHoliday && !hasOt) {
        bands.push({
          start: cursor.startOf('day').toDate(),
          end: cursor.add(1, 'day').startOf('day').toDate(),
          title: key,
        });
      }
    } else {
      for (const [s, e] of invertDayWindows(cursor, work)) {
        if (e.valueOf() <= rangeStart.getTime() || s.valueOf() >= rangeEnd.getTime()) continue;
        const clippedStart = Math.max(s.valueOf(), rangeStart.getTime());
        const clippedEnd = Math.min(e.valueOf(), rangeEnd.getTime());
        if (clippedEnd > clippedStart) {
          bands.push({
            start: new Date(clippedStart),
            end: new Date(clippedEnd),
            title: key,
          });
        }
      }
    }
    cursor = cursor.add(1, 'day');
  }
  return bands;
}
