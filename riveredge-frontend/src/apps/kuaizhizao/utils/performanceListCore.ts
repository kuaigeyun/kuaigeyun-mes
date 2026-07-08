import type { TFunction } from 'i18next';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';
import { getPerformanceSummaryStatusValueEnum } from '../pages/performance/components/performanceMeta';

export const PERFORMANCE_PINNED_ACTIVE_FIELD = 'isActive';
export const PERFORMANCE_PINNED_IS_ACTIVE_FIELD = 'is_active';
export const PERFORMANCE_SUMMARY_PINNED_STATUS_FIELD = 'status';

export function normalizePerformanceListResponse(res: unknown): { data: unknown[]; total: number } {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  if (res && typeof res === 'object') {
    const obj = res as { items?: unknown[]; data?: unknown[]; total?: number };
    const data = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.data) ? obj.data : [];
    const total = typeof obj.total === 'number' ? obj.total : data.length;
    return { data, total };
  }
  return { data: [], total: 0 };
}

function pickString(searchFormValues: Record<string, unknown> | null | undefined, key: string) {
  const v = searchFormValues?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolveOrderBy(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  return sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
}

function resolveOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function resolveMasterListDateParams(searchFormValues?: Record<string, unknown> | null) {
  const s = searchFormValues ?? {};
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  return { created_start_date, created_end_date, updated_start_date, updated_end_date };
}

export function resolveHolidayListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  const dates = resolveMasterListDateParams(s);
  const { date_start: start_date, date_end: end_date } = parseSalesReportDateRange(s, [
    'holiday_date_range',
    'holidayDateRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    holiday_type: typeof s.holidayType === 'string' && s.holidayType ? s.holidayType : pickString(s, 'holiday_type'),
    start_date,
    end_date,
    is_active: resolveOptionalBoolean(s.isActive ?? s.is_active),
    ...dates,
  };
}

export function resolveSkillListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
    is_active: resolveOptionalBoolean(s.isActive ?? s.is_active),
    ...resolveMasterListDateParams(s),
  };
}

export function resolveShiftListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    is_active: resolveOptionalBoolean(s.isActive ?? s.is_active),
    ...resolveMasterListDateParams(s),
  };
}

export function resolveEmployeeConfigListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    employee_id:
      s.employee_id != null && s.employee_id !== '' ? Number(s.employee_id) : undefined,
    calc_mode:
      typeof s.calc_mode === 'string' && s.calc_mode
        ? s.calc_mode
        : typeof s.calcMode === 'string' && s.calcMode
          ? s.calcMode
          : undefined,
    is_active: resolveOptionalBoolean(s.is_active ?? s.isActive),
    ...resolveMasterListDateParams(s),
  };
}

export function resolveHourlyRateListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    is_active: resolveOptionalBoolean(s.is_active ?? s.isActive),
    ...resolveMasterListDateParams(s),
  };
}

export function resolveKpiDefinitionListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    calc_type:
      typeof s.calc_type === 'string' && s.calc_type
        ? s.calc_type
        : typeof s.calcType === 'string' && s.calcType
          ? s.calcType
          : undefined,
    is_active: resolveOptionalBoolean(s.is_active ?? s.isActive),
    ...resolveMasterListDateParams(s),
  };
}

export function resolvePerformanceSummaryListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  toolbar?: { period?: string; employee_id?: number },
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    period: toolbar?.period || pickString(s, 'period'),
    employee_id: toolbar?.employee_id,
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    ...resolveMasterListDateParams(s),
  };
}

export function buildPerformanceSummaryStatusValueEnum(t: TFunction) {
  return getPerformanceSummaryStatusValueEnum(t);
}
