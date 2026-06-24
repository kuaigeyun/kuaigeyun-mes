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

function parseNamedDateRange(
  search: Record<string, unknown> | undefined,
  fieldKey: string,
): { from?: string; to?: string } {
  if (!search) return {};
  const raw = search[fieldKey];
  if (!Array.isArray(raw) || raw.length < 2) return {};
  const a = raw[0] as string | Dayjs | Date | null | undefined;
  const b = raw[1] as string | Dayjs | Date | null | undefined;
  if (a == null || b == null) return {};
  const d0 = dayjs(a as never);
  const d1 = dayjs(b as never);
  if (!d0.isValid() || !d1.isValid()) return {};
  return {
    from: d0.startOf('day').toISOString(),
    to: d1.endOf('day').toISOString(),
  };
}

function optionalTrimmedString(search: Record<string, unknown> | undefined, key: string): string | undefined {
  const raw = search?.[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function optionalPositiveInt(search: Record<string, unknown> | undefined, key: string): number | undefined {
  const raw = search?.[key];
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 产能查询高级搜索 → API 查询参数 */
export function parseEquipmentCapacitySearchParams(search: Record<string, unknown> | undefined) {
  const recorded = parseEquipmentReportRecordedRange(search);
  const startup = parseNamedDateRange(search, 'startup_at_range');
  const completed = parseNamedDateRange(search, 'completed_at_range');
  return {
    recorded_from: recorded.recorded_from,
    recorded_to: recorded.recorded_to,
    startup_from: startup.from,
    startup_to: startup.to,
    completed_from: completed.from,
    completed_to: completed.to,
    equipment_id: optionalPositiveInt(search, 'equipment_id'),
    workshop_id: optionalPositiveInt(search, 'workshop_id'),
    sheet_no: optionalTrimmedString(search, 'sheet_no'),
    work_order_no: optionalTrimmedString(search, 'work_order_no'),
    finished_product_code: optionalTrimmedString(search, 'finished_product_code'),
    finished_product_name: optionalTrimmedString(search, 'finished_product_name'),
    operator_name: optionalTrimmedString(search, 'operator_name'),
    team_leader_name: optionalTrimmedString(search, 'team_leader_name'),
    keyword: optionalTrimmedString(search, 'keyword'),
  };
}
