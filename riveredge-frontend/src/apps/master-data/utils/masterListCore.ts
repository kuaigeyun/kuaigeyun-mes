import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import type { FactoryPaginatedList } from '../types/factory';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formatDateTime } from '../../../utils/format';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import { UniTableStackedPrimaryCell } from '../../../components/uni-table/stackedPrimaryColumn';

export const MASTER_CRUD_PINNED_ACTIVE_FIELD = 'isActive';

/** @deprecated 列表列序唯一真源为 GLOBAL_DOC_LIST_FIELD_RANK；此别名仅兼容旧 import。 */
export {
  GLOBAL_DOC_LIST_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK as MASTER_DATA_LIST_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK as SALES_DOC_LIST_FIELD_RANK,
} from '../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

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

export type MasterBatchDeletePayload = {
  success_count: number;
  failed_count: number;
  success_records: Array<{ uuid: string; code?: string; name?: string }>;
  failed_records: Array<{ uuid: string; code?: string; name?: string; reason: string }>;
};

export type MasterBatchDeleteResult = {
  success: boolean;
  message: string;
  data: MasterBatchDeletePayload;
};

/**
 * 归一化批量删除响应。
 * apiRequest 在 `{ success: true, data }` 时会解包成内层 data，丢失顶层 success，
 * 页面若仍读 result.success 会误判为「部分删除失败」。
 */
export function normalizeMasterBatchDeleteResponse(raw: unknown): MasterBatchDeleteResult {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const nested =
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : null;
  const payload =
    nested && ('failed_count' in nested || 'success_count' in nested) ? nested : obj;

  const success_count = Number(payload.success_count ?? 0);
  const failed_count = Number(payload.failed_count ?? 0);
  const success_records = Array.isArray(payload.success_records)
    ? (payload.success_records as MasterBatchDeletePayload['success_records'])
    : [];
  const failed_records = Array.isArray(payload.failed_records)
    ? (payload.failed_records as MasterBatchDeletePayload['failed_records'])
    : [];
  const message =
    typeof obj.message === 'string' && obj.message.trim()
      ? obj.message
      : failed_count === 0
        ? ''
        : '';

  return {
    success: failed_count === 0,
    message,
    data: {
      success_count,
      failed_count,
      success_records,
      failed_records,
    },
  };
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
  T extends Record<string, unknown>,
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.updatedAt'),
      dataIndex: 'updatedAt',
      width: 148,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => {
        const preferred = resolveMasterPreferredAudit(r as Record<string, unknown>);
        return React.createElement(UniTableStackedPrimaryCell, {
          primary: preferred.operator,
          secondary: preferred.time,
          secondaryCopyable: false,
          primaryBold: false,
        });
      },
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
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 31,
      formItemProps: formDateRangeFormItemProps,
    },
  ];
}

function resolveMasterPreferredAudit(record: Record<string, unknown>): { operator: string; time: string } {
  const updatedOperator = resolveMasterOperatorName(record, 'updated');
  const updatedTime = resolveMasterAuditTime(record, 'updated');
  if (updatedOperator !== '-' && updatedTime !== '-') {
    return {
      operator: updatedOperator,
      time: updatedTime,
    };
  }
  const createdOperator = resolveMasterOperatorName(record, 'created');
  const createdTime = resolveMasterAuditTime(record, 'created');
  if (createdOperator !== '-' && createdTime !== '-') {
    return { operator: createdOperator, time: createdTime };
  }
  if (updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  return {
    operator: createdOperator,
    time: createdTime,
  };
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

function resolveMasterOperatorName(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const candidates =
    key === 'created'
      ? ['created_by_name', 'creator_name', 'created_user_name', 'createdByName', 'creatorName']
      : ['updated_by_name', 'updater_name', 'updated_user_name', 'updatedByName', 'updaterName'];
  for (const candidate of candidates) {
    const value = String(record[candidate] ?? '').trim();
    if (value) return value;
  }
  return '-';
}

function resolveMasterAuditTime(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const value =
    key === 'created'
      ? (record.createdAt ?? record.created_at)
      : (record.updatedAt ?? record.updated_at);
  return formatMasterDateTimeCell(value);
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
