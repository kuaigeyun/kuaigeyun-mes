import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';
import { formatDateTime } from '../../../utils/format';

export function normalizeCustomerPoolListResponse(res: unknown): { data: unknown[]; total: number } {
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

function parseDateTimeRange(range: unknown): { from?: string; to?: string } {
  if (!range || !Array.isArray(range) || !range[0]) {
    return {};
  }
  const from = formatDateTime(range[0] as string | Date, 'YYYY-MM-DD HH:mm:ss');
  const to = range[1] ? formatDateTime(range[1] as string | Date, 'YYYY-MM-DD HH:mm:ss') : from;
  return { from, to };
}

export function resolveCustomerPoolListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const lastFollowUpRange = parseDateTimeRange(s.last_follow_up_at_range);
  const recycleRange = parseDateTimeRange(s.recycle_at_range);
  const assignedRange = parseDateTimeRange(s.assigned_at_range);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const salesmanRaw = s.salesmanId;
  const salesmanId =
    salesmanRaw != null && salesmanRaw !== '' ? Number(salesmanRaw) : undefined;
  const poolStatusRaw = s.poolStatus;
  const poolStatus =
    poolStatusRaw === 'pool' || poolStatusRaw === 'owned' ? poolStatusRaw : undefined;

  const params: Record<string, string | number | undefined> = {
    order_by: resolveOrderBy(sort),
    salesmanId: Number.isFinite(salesmanId) && salesmanId! > 0 ? salesmanId : undefined,
    poolStatus,
    last_follow_up_from: lastFollowUpRange.from,
    last_follow_up_to: lastFollowUpRange.to,
    recycle_from: recycleRange.from,
    recycle_to: recycleRange.to,
    assigned_from: assignedRange.from,
    assigned_to: assignedRange.to,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const code = pickString(s, 'code');
    const name = pickString(s, 'name');
    const contactPerson = pickString(s, 'contact_person');
    const phone = pickString(s, 'phone');
    if (code) params.code = code;
    if (name) params.name = name;
    if (contactPerson) params.contact_person = contactPerson;
    if (phone) params.phone = phone;
  }

  return params;
}

export function formatCustomerPoolDateTimeCell(value: unknown): string {
  if (!value) return '—';
  return formatDateTime(value as string | Date, 'YYYY-MM-DD HH:mm');
}
