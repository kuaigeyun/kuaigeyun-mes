import type { ProductProcessLine } from '../types/productProcess';

const MINUTES_PER_HOUR = 60;

/** 后端 / 路线序列存小时，界面编辑与展示用分钟 */
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

export function productProcessLineFromApi(line: ProductProcessLine): ProductProcessLine {
  return {
    ...line,
    standardTime: hoursToDisplayMinutes(line.standardTime),
    setupTime: hoursToDisplayMinutes(line.setupTime),
  };
}

export function productProcessLineToApi(line: ProductProcessLine): ProductProcessLine {
  return {
    ...line,
    standardTime: displayMinutesToHours(line.standardTime),
    setupTime: displayMinutesToHours(line.setupTime),
  };
}
