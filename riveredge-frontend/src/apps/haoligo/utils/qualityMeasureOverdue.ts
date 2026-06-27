import dayjs, { type Dayjs } from 'dayjs';
import { QUALITY_OVERDUE_GRACE_DAYS } from './qualityMeta';

export function addQualityOverdueGraceDays(dueAt: Dayjs | null | undefined): Dayjs | null {
  if (!dueAt || !dueAt.isValid()) return null;
  return dueAt.add(QUALITY_OVERDUE_GRACE_DAYS, 'day');
}

export function formatQualityMeasureOverdueAt(dueAt: unknown): string {
  if (dueAt == null || dueAt === '') return '—';
  const parsed = dayjs.isDayjs(dueAt) ? dueAt : dayjs(dueAt as string);
  if (!parsed.isValid()) return '—';
  const overdueAt = addQualityOverdueGraceDays(parsed);
  return overdueAt ? overdueAt.format('YYYY-MM-DD HH:mm') : '—';
}
