import type { ManufacturingTimeUnit, ProductProcessLine } from '../types/productProcess';

/** 工艺路线仍存小时，编辑器用分钟展示 */
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export type { ManufacturingTimeUnit };

/** 后端 / 路线序列存小时，界面编辑与展示用分钟（工艺路线路径） */
export function hoursToDisplayMinutes(hours?: number | null): number | undefined {
  if (hours == null) return undefined;
  const n = Number(hours);
  if (!Number.isFinite(n)) return undefined;
  return n * MINUTES_PER_HOUR;
}

export function displayMinutesToHours(minutes?: number | null): number | undefined {
  if (minutes == null) return undefined;
  const n = Number(minutes);
  if (!Number.isFinite(n)) return undefined;
  return n / MINUTES_PER_HOUR;
}

export function toSeconds(
  value?: number | null,
  unit: ManufacturingTimeUnit = 'm',
): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (unit === 'h') return n * SECONDS_PER_HOUR;
  if (unit === 's') return n;
  return n * SECONDS_PER_MINUTE;
}

export function fromSeconds(
  seconds?: number | null,
  unit: ManufacturingTimeUnit = 'm',
): number | undefined {
  if (seconds == null) return undefined;
  const n = Number(seconds);
  if (!Number.isFinite(n)) return undefined;
  if (unit === 'h') return n / SECONDS_PER_HOUR;
  if (unit === 's') return n;
  return n / SECONDS_PER_MINUTE;
}

export function normalizeTimeUnit(unit?: string | null): ManufacturingTimeUnit {
  if (unit === 'h' || unit === 'm' || unit === 's') return unit;
  return 'm';
}

/** API（秒）→ 界面（选定单位下的显示值） */
export function productProcessLineFromApi(line: ProductProcessLine): ProductProcessLine {
  const stdUnit = normalizeTimeUnit(line.standardTimeUnit);
  const setupUnit = normalizeTimeUnit(line.setupTimeUnit);
  const qty =
    line.standardTimeQty != null && Number(line.standardTimeQty) >= 1
      ? Number(line.standardTimeQty)
      : 1;
  return {
    ...line,
    standardTime: fromSeconds(line.standardTime, stdUnit),
    standardTimeUnit: stdUnit,
    standardTimeQty: qty,
    setupTime: fromSeconds(line.setupTime, setupUnit),
    setupTimeUnit: setupUnit,
  };
}

/** 界面 → API（秒 + 件数基准 + 单位偏好） */
export function productProcessLineToApi(line: ProductProcessLine): ProductProcessLine {
  const stdUnit = normalizeTimeUnit(line.standardTimeUnit);
  const setupUnit = normalizeTimeUnit(line.setupTimeUnit);
  const qty =
    line.standardTimeQty != null && Number(line.standardTimeQty) >= 1
      ? Number(line.standardTimeQty)
      : 1;
  return {
    ...line,
    standardTime: toSeconds(line.standardTime, stdUnit),
    standardTimeUnit: stdUnit,
    standardTimeQty: qty,
    setupTime: toSeconds(line.setupTime, setupUnit),
    setupTimeUnit: setupUnit,
  };
}
