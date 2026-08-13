import type { Dayjs } from 'dayjs';
import dayjs from '../../../config/dayjs';
import { getTimezoneFromSiteSetting } from '../../../utils/format';

export const REPORTING_WORK_START_FIELD = 'work_start_time';
export const REPORTING_WORK_END_FIELD = 'work_end_time';
export const REPORTING_WORK_HOURS_FIELD = 'work_hours';

export type ReportingWorkTimeField =
  | typeof REPORTING_WORK_START_FIELD
  | typeof REPORTING_WORK_END_FIELD
  | typeof REPORTING_WORK_HOURS_FIELD;

/**
 * 报工三字段联动（两项推第三项）最佳实践：
 *
 * 1. 起止时刻优先：开始+结束都有效时，改任一端 → 重算工时（绝不倒推另一端）
 * 2. 开始为锚点：改工时且已有开始 → 重算结束
 * 3. 仅一端+工时：有开始无结束 → 推结束；有结束无开始 → 推开始
 * 4. 只填一项或非法区间（结束早于开始）→ 不自动改其它字段
 */
export function toReportingDayjs(value: unknown): Dayjs | null {
  if (value == null || value === '') return null;
  if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
  const tz = getTimezoneFromSiteSetting();
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.includes('T') ? text.replace('T', ' ').slice(0, 19) : text;
  const parsed = dayjs.tz(normalized.length <= 10 ? `${normalized} 00:00:00` : normalized, tz);
  return parsed.isValid() ? parsed : null;
}

export function roundReportingWorkHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function formatReportingDateTime(value: Dayjs): string {
  return value.format('YYYY-MM-DD HH:mm:ss');
}

/** null/空视为未填；0 是合法工时 */
export function parseReportingWorkHours(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function hoursFromRange(start: Dayjs, end: Dayjs): number {
  return roundReportingWorkHours(end.diff(start, 'minute') / 60);
}

export function deriveReportingWorkTimeUpdates(
  source: ReportingWorkTimeField,
  values: {
    work_start_time?: unknown;
    work_end_time?: unknown;
    work_hours?: unknown;
  },
): Partial<Record<ReportingWorkTimeField, Dayjs | number>> {
  const start = toReportingDayjs(values.work_start_time);
  const end = toReportingDayjs(values.work_end_time);
  const hours = parseReportingWorkHours(values.work_hours);
  const rangeValid = !!(start && end && !end.isBefore(start));

  if (source === REPORTING_WORK_START_FIELD) {
    if (!start) return {};
    // 起止齐全：时刻权威 → 重算工时
    if (rangeValid) {
      return { [REPORTING_WORK_HOURS_FIELD]: hoursFromRange(start, end!) };
    }
    // 仅开始+工时 → 推结束
    if (hours != null) {
      return { [REPORTING_WORK_END_FIELD]: start.add(hours, 'hour') };
    }
    return {};
  }

  if (source === REPORTING_WORK_END_FIELD) {
    if (!end) return {};
    // 起止齐全：时刻权威 → 重算工时（禁止用旧工时倒推开始）
    if (rangeValid) {
      return { [REPORTING_WORK_HOURS_FIELD]: hoursFromRange(start!, end) };
    }
    // 仅结束+工时 → 推开始
    if (hours != null) {
      return { [REPORTING_WORK_START_FIELD]: end.subtract(hours, 'hour') };
    }
    return {};
  }

  // source === work_hours
  if (hours == null) return {};
  // 开始锚定：有开始则推结束（即使结束已有，改工时表示调整时长）
  if (start) {
    return { [REPORTING_WORK_END_FIELD]: start.add(hours, 'hour') };
  }
  if (end) {
    return { [REPORTING_WORK_START_FIELD]: end.subtract(hours, 'hour') };
  }
  return {};
}

export function resolveReportingWorkTimeForSubmit(values: Record<string, unknown>): {
  work_hours: number;
  reported_at: string;
  work_start_time?: string;
  work_end_time?: string;
} {
  let start = toReportingDayjs(values.work_start_time);
  let end = toReportingDayjs(values.work_end_time);
  let hours = parseReportingWorkHours(values.work_hours) ?? 0;

  // 提交时同样：缺一端用工时补全；两端齐全则以时刻重算工时
  if (start && !end && hours > 0) {
    end = start.add(hours, 'hour');
  } else if (end && !start && hours > 0) {
    start = end.subtract(hours, 'hour');
  }

  if (start && end && !end.isBefore(start)) {
    hours = hoursFromRange(start, end);
  }

  const tz = getTimezoneFromSiteSetting();
  const now = dayjs().tz(tz);
  let reportedAt = now.format('YYYY-MM-DD HH:mm:ss');
  if (end) {
    reportedAt = formatReportingDateTime(end);
  } else if (start && hours > 0) {
    reportedAt = formatReportingDateTime(start.add(hours, 'hour'));
  }

  return {
    work_hours: hours,
    reported_at: reportedAt,
    work_start_time: start ? formatReportingDateTime(start) : undefined,
    work_end_time: end ? formatReportingDateTime(end) : undefined,
  };
}
