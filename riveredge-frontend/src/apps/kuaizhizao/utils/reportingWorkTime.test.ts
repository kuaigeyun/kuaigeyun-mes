import { describe, expect, it } from 'vitest';
import type { Dayjs } from 'dayjs';
import dayjs from '../../../config/dayjs';
import {
  REPORTING_WORK_END_FIELD,
  REPORTING_WORK_HOURS_FIELD,
  REPORTING_WORK_START_FIELD,
  deriveReportingWorkTimeUpdates,
  parseReportingWorkHours,
} from './reportingWorkTime';

describe('parseReportingWorkHours', () => {
  it('treats null/empty as missing', () => {
    expect(parseReportingWorkHours(null)).toBeNull();
    expect(parseReportingWorkHours('')).toBeNull();
    expect(parseReportingWorkHours(undefined)).toBeNull();
  });

  it('accepts zero and positive numbers', () => {
    expect(parseReportingWorkHours(0)).toBe(0);
    expect(parseReportingWorkHours('1.5')).toBe(1.5);
  });
});

describe('deriveReportingWorkTimeUpdates', () => {
  const start = dayjs('2026-08-13 05:00:00');
  const end = dayjs('2026-08-13 06:00:00');

  it('changing start with start+end filled recomputes hours, not end', () => {
    const nextStart = dayjs('2026-08-13 04:00:00');
    const updates = deriveReportingWorkTimeUpdates(REPORTING_WORK_START_FIELD, {
      work_start_time: nextStart,
      work_end_time: end,
      work_hours: 1,
    });
    expect(updates[REPORTING_WORK_HOURS_FIELD]).toBe(2);
    expect(updates[REPORTING_WORK_END_FIELD]).toBeUndefined();
  });

  it('changing end with start+end filled recomputes hours, not start', () => {
    const nextEnd = dayjs('2026-08-13 07:00:00');
    const updates = deriveReportingWorkTimeUpdates(REPORTING_WORK_END_FIELD, {
      work_start_time: start,
      work_end_time: nextEnd,
      work_hours: 1,
    });
    expect(updates[REPORTING_WORK_HOURS_FIELD]).toBe(2);
    expect(updates[REPORTING_WORK_START_FIELD]).toBeUndefined();
  });

  it('changing hours with start filled moves end', () => {
    const updates = deriveReportingWorkTimeUpdates(REPORTING_WORK_HOURS_FIELD, {
      work_start_time: start,
      work_end_time: end,
      work_hours: 2,
    });
    expect((updates[REPORTING_WORK_END_FIELD] as Dayjs).format('YYYY-MM-DD HH:mm')).toBe(
      '2026-08-13 07:00',
    );
    expect(updates[REPORTING_WORK_START_FIELD]).toBeUndefined();
  });

  it('start + hours without end derives end', () => {
    const updates = deriveReportingWorkTimeUpdates(REPORTING_WORK_START_FIELD, {
      work_start_time: start,
      work_hours: 1,
    });
    expect((updates[REPORTING_WORK_END_FIELD] as Dayjs).format('YYYY-MM-DD HH:mm')).toBe(
      '2026-08-13 06:00',
    );
  });

  it('end + hours without start derives start', () => {
    const updates = deriveReportingWorkTimeUpdates(REPORTING_WORK_END_FIELD, {
      work_end_time: end,
      work_hours: 1,
    });
    expect((updates[REPORTING_WORK_START_FIELD] as Dayjs).format('YYYY-MM-DD HH:mm')).toBe(
      '2026-08-13 05:00',
    );
  });
});
