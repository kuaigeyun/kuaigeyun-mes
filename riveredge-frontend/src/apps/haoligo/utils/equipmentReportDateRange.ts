import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

/** 从 ProTable 搜索表单解析「产出时间」区间，供报表 API `recorded_from` / `recorded_to` */
export function parseEquipmentReportRecordedRange(search: Record<string, unknown> | undefined): {
  recorded_from?: string;
  recorded_to?: string;
} {
  if (!search) return {};
  const keys = ['recorded_at_range', 'recorded_at', 'date_range'] as const;
  for (const key of keys) {
    const raw = search[key];
    if (!Array.isArray(raw) || raw.length < 2) continue;
    const a = raw[0] as string | Dayjs | Date | null | undefined;
    const b = raw[1] as string | Dayjs | Date | null | undefined;
    if (a == null || b == null) continue;
    const d0 = dayjs(a as never);
    const d1 = dayjs(b as never);
    if (!d0.isValid() || !d1.isValid()) continue;
    return {
      recorded_from: d0.startOf('day').toISOString(),
      recorded_to: d1.endOf('day').toISOString(),
    };
  }
  return {};
}

/** 默认查询本月 1 日至今 */
export function defaultEquipmentReportRecordedRange(): [Dayjs, Dayjs] {
  return [dayjs().startOf('month'), dayjs().endOf('day')];
}
