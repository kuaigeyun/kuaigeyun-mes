import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

/** 从 ProTable 搜索表单解析「创建时间」区间，供报表列表 API `created_from` / `created_to`（ISO8601） */
export function parseMoldReportCreatedRange(search: Record<string, unknown> | undefined): {
  created_from?: string;
  created_to?: string;
} {
  if (!search) return {};
  const keys = ['created_at_range', 'created_at', 'date_range'] as const;
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
      created_from: d0.startOf('day').toISOString(),
      created_to: d1.endOf('day').toISOString(),
    };
  }
  return {};
}
