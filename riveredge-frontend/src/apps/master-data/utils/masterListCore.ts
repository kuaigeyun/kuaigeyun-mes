import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import type { FactoryPaginatedList } from '../types/factory';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formatDateTime } from '../../../utils/format';
import { formDateRangeFormItemProps } from '../../../utils/formDate';

export const MASTER_CRUD_PINNED_ACTIVE_FIELD = 'isActive';

export function normalizeMasterListResponse<T>(
  res: FactoryPaginatedList<T> | T[] | null | undefined,
): { data: T[]; total: number } {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  if (res && typeof res === 'object') {
    const obj = res as FactoryPaginatedList<T> & { data?: T[] };
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

function resolveMasterCrudSort(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  if (!sortBy || !sortOrder) {
    return { sort_field: undefined, sort_order: undefined };
  }
  return {
    sort_field: sortBy,
    sort_order: sortOrder === 'desc' ? 'desc' : 'asc',
  };
}

export function pickOptionalId(
  search: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = search[key];
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function pickOptionalString(
  search: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = search[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function masterCrudCodeNameSearchColumns(
  labels: { code: string; name: string },
  orders: { code?: number; name?: number } = {},
): ProColumns[] {
  return [
    {
      title: labels.code,
      dataIndex: 'code',
      hideInTable: true,
      order: orders.code ?? 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.name,
      dataIndex: 'name',
      hideInTable: true,
      order: orders.name ?? 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function masterCrudCreatedUpdatedColumns<
  T extends { createdAt?: string; updatedAt?: string },
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatMasterDateTimeCell(r.createdAt),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 30,
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updatedAt',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatMasterDateTimeCell(r.updatedAt),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 31,
      formItemProps: formDateRangeFormItemProps,
    },
  ];
}

export function buildMasterCrudActiveValueEnum(
  t: (key: string) => string,
  enabledKey: string,
  disabledKey: string,
): Record<string, { text: string }> {
  return {
    true: { text: t(enabledKey) },
    false: { text: t(disabledKey) },
  };
}

export function formatMasterDateTimeCell(value: unknown): string {
  if (!value) return '-';
  return formatDateTime(value as string | Date, 'YYYY-MM-DD HH:mm');
}

export function resolveMasterCrudListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: {
    activeField?: string;
    extra?: (search: Record<string, unknown>) => Record<string, string | number | boolean | undefined>;
  },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const activeField = options?.activeField ?? MASTER_CRUD_PINNED_ACTIVE_FIELD;
  const fuzzyKeyword = pickString(s, 'keyword');
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  const { sort_field, sort_order } = resolveMasterCrudSort(sort);

  const activeRaw = s[activeField];
  const is_active =
    activeRaw === true || activeRaw === 'true'
      ? true
      : activeRaw === false || activeRaw === 'false'
        ? false
        : undefined;

  const params: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    is_active,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
    ...(options?.extra?.(s) ?? {}),
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const code = pickString(s, 'code');
    const name = pickString(s, 'name');
    if (code) params.code = code;
    if (name) params.name = name;
  }

  return params;
}
