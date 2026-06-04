/**
 * RiverGantt 时间刻度（纯函数，可单测）。
 *
 * 负责：多行刻度表头单元格生成、strftime 风格日期格式化、最小刻度单位与标称毫秒数。
 */

import dayjs from 'dayjs';
import type { RiverGanttScale, RiverScaleUnit } from './types';

export const UNIT_MS: Record<RiverScaleUnit, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export function getMinUnit(scales: RiverGanttScale[]): RiverScaleUnit {
  return scales.length > 0 ? scales[scales.length - 1].unit : 'day';
}

export function getUnitMs(unit: RiverScaleUnit): number {
  return UNIT_MS[unit] ?? UNIT_MS.day;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO-8601 周序号（周一为一周起点）。 */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** 支持 %Y %y %m %d %W %H %M %%，其余字符原样输出。 */
export function formatScaleString(fmt: string, date: Date): string {
  return fmt.replace(/%([YymdWHM%])/g, (_match, token: string) => {
    switch (token) {
      case 'Y':
        return String(date.getFullYear());
      case 'y':
        return pad2(date.getFullYear() % 100);
      case 'm':
        return pad2(date.getMonth() + 1);
      case 'd':
        return pad2(date.getDate());
      case 'W':
        return String(isoWeek(date));
      case 'H':
        return pad2(date.getHours());
      case 'M':
        return pad2(date.getMinutes());
      case '%':
        return '%';
      default:
        return '';
    }
  });
}

export function formatScale(
  format: RiverGanttScale['format'],
  date: Date,
  next?: Date
): string {
  if (typeof format === 'function') return format(date, next);
  return formatScaleString(format, date);
}

function startOfUnit(date: Date, unit: RiverScaleUnit): Date {
  const m = dayjs(date);
  switch (unit) {
    case 'year':
      return m.startOf('year').toDate();
    case 'month':
      return m.startOf('month').toDate();
    case 'week':
      return m.startOf('week').toDate();
    case 'day':
      return m.startOf('day').toDate();
    case 'hour':
      return m.startOf('hour').toDate();
    default:
      return m.toDate();
  }
}

function addUnit(date: Date, unit: RiverScaleUnit, step: number): Date {
  return dayjs(date)
    .add(step, unit as dayjs.ManipulateType)
    .toDate();
}

export interface ScaleCell {
  left: number;
  width: number;
  label: string;
  css?: string;
  start: Date;
  end: Date;
}

export interface ScaleRow {
  unit: RiverScaleUnit;
  cells: ScaleCell[];
}

/**
 * 生成多行刻度。pxPerMs 由调用方依据 cellWidth/最小单元 提供，保证一格 ≈ cellWidth。
 */
export function buildScaleRows(
  scales: RiverGanttScale[],
  start: Date,
  end: Date,
  pxPerMs: number
): ScaleRow[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return scales.map((scale) => {
    const cells: ScaleCell[] = [];
    let cursor = startOfUnit(start, scale.unit);
    // 防御：步长非法时退化为 1，避免死循环
    const step = scale.step > 0 ? scale.step : 1;
    let guard = 0;
    while (cursor.getTime() < endMs && guard < 100000) {
      guard += 1;
      const next = addUnit(cursor, scale.unit, step);
      const cellStartMs = Math.max(cursor.getTime(), startMs);
      const cellEndMs = Math.min(next.getTime(), endMs);
      if (cellEndMs > cellStartMs) {
        cells.push({
          left: (cellStartMs - startMs) * pxPerMs,
          width: (cellEndMs - cellStartMs) * pxPerMs,
          label: formatScale(scale.format, cursor, next),
          css: scale.css?.(cursor),
          start: new Date(cellStartMs),
          end: new Date(cellEndMs),
        });
      }
      cursor = next;
    }
    return { unit: scale.unit, cells };
  });
}
