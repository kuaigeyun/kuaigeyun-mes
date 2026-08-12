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
  const hoursRaw = Number(values.work_hours);
  const hasHours = Number.isFinite(hoursRaw) && hoursRaw >= 0;

  if (source === REPORTING_WORK_START_FIELD) {
    if (!start) return {};
    if (hasHours) return { [REPORTING_WORK_END_FIELD]: start.add(hoursRaw, 'hour') };
    if (end && !end.isBefore(start)) {
      return { [REPORTING_WORK_HOURS_FIELD]: roundReportingWorkHours(end.diff(start, 'minute') / 60) };
    }
    return {};
  }

  if (source === REPORTING_WORK_END_FIELD) {
    if (!end) return {};
    if (hasHours) return { [REPORTING_WORK_START_FIELD]: end.subtract(hoursRaw, 'hour') };
    if (start && !end.isBefore(start)) {
      return { [REPORTING_WORK_HOURS_FIELD]: roundReportingWorkHours(end.diff(start, 'minute') / 60) };
    }
    return {};
  }

  if (!hasHours) return {};
  if (start) return { [REPORTING_WORK_END_FIELD]: start.add(hoursRaw, 'hour') };
  if (end) return { [REPORTING_WORK_START_FIELD]: end.subtract(hoursRaw, 'hour') };
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
  let hours = Number(values.work_hours);
  if (!Number.isFinite(hours) || hours < 0) hours = 0;

  if (start && !end && hours > 0) {
    end = start.add(hours, 'hour');
  } else if (end && !start && hours > 0) {
    start = end.subtract(hours, 'hour');
  }

  if (start && end && !end.isBefore(start)) {
    hours = roundReportingWorkHours(end.diff(start, 'minute') / 60);
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
