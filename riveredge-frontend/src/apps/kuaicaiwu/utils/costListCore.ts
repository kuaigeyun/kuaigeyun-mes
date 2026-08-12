import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formatDateTime } from '../../../utils/format';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_AUDIT_COLUMN_DEFAULTS,
} from '../../../components/uni-table/stackedPrimaryColumn';

export const COST_CALCULATION_PINNED_STATUS_FIELD = 'calculation_status';
export const COST_CRUD_PINNED_ACTIVE_FIELD = 'isActive';

function pickString(search: Record<string, unknown> | null | undefined, key: string) {
  const v = search?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function pickOptionalId(search: Record<string, unknown>, key: string): number | undefined {
  const v = search[key];
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolveCostSort(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  if (!sortBy || !sortOrder) {
    return { sort_field: undefined, sort_order: undefined };
  }
  return {
    sort_field: sortBy,
    sort_order: sortOrder === 'desc' ? 'desc' : 'asc',
  };
}

export function formatCostDateTimeCell(value: unknown): string {
  if (!value) return '-';
  return formatDateTime(value as string | Date, 'YYYY-MM-DD HH:mm');
}

function resolveCostOperatorName(record: Record<string, unknown>, key: 'created' | 'updated'): string {
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

function resolveCostAuditTime(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const value =
    key === 'created'
      ? (record.created_at ?? record.createdAt)
      : (record.updated_at ?? record.updatedAt);
  return formatCostDateTimeCell(value);
}

function resolveCostPreferredAudit(record: Record<string, unknown>): { operator: string; time: string } {
  const updatedOperator = resolveCostOperatorName(record, 'updated');
  const updatedTime = resolveCostAuditTime(record, 'updated');
  if (updatedOperator !== '-' && updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  const createdOperator = resolveCostOperatorName(record, 'created');
  const createdTime = resolveCostAuditTime(record, 'created');
  if (createdOperator !== '-' && createdTime !== '-') {
    return { operator: createdOperator, time: createdTime };
  }
  if (updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  return { operator: createdOperator, time: createdTime };
}

export function costDocCreatedUpdatedColumns<T extends object>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      ...UNI_TABLE_STACKED_AUDIT_COLUMN_DEFAULTS,
      sorter: true,
      render: (_, r) => {
        const preferred = resolveCostPreferredAudit(r as Record<string, unknown>);
        return React.createElement(UniTableStackedPrimaryCell, {
          primary: preferred.operator,
          secondary: preferred.time,
          secondaryCopyable: false,
          primaryBold: false,
        });
      },
    } as ProColumns<T>,
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

export function costCalculationSearchColumns(labels: {
  calculationNo: string;
  workOrderCode: string;
  productCode: string;
  productName: string;
}): ProColumns[] {
  return [
    {
      title: labels.calculationNo,
      dataIndex: 'calculation_no',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.workOrderCode,
      dataIndex: 'work_order_code',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.productCode,
      dataIndex: 'product_code',
      hideInTable: true,
      order: 12,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.productName,
      dataIndex: 'product_name',
      hideInTable: true,
      order: 13,
      fieldProps: { allowClear: true },
    },
  ];
}

export function costRuleSearchColumns(labels: { code: string; name: string }): ProColumns[] {
  return [
    {
      title: labels.code,
      dataIndex: 'code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.name,
      dataIndex: 'name',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function standardCostSearchColumns(labels: {
  targetCode: string;
  targetName: string;
}): ProColumns[] {
  return [
    {
      title: labels.targetCode,
      dataIndex: 'target_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.targetName,
      dataIndex: 'target_name',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function resolveCostCalculationListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveCostSort(sort);
  const { date_start: calculation_date_start, date_end: calculation_date_end } = parseSalesReportDateRange(s, [
    'calculation_date_range',
    'calculationDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    calculation_type: pickString(s, 'calculation_type'),
    calculation_status: pickString(s, 'calculation_status'),
    sort_field,
    sort_order,
    calculation_date_start,
    calculation_date_end,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  const workOrderId = pickOptionalId(s, 'work_order_id');
  const productId = pickOptionalId(s, 'product_id');
  if (workOrderId) params.work_order_id = workOrderId;
  if (productId) params.product_id = productId;

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const calculationNo = pickString(s, 'calculation_no');
    const workOrderCode = pickString(s, 'work_order_code');
    const productCode = pickString(s, 'product_code');
    const productName = pickString(s, 'product_name');
    if (calculationNo) params.calculation_no = calculationNo;
    if (workOrderCode) params.work_order_code = workOrderCode;
    if (productCode) params.product_code = productCode;
    if (productName) params.product_name = productName;
  }

  return params;
}

export function resolveCostRuleListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveCostSort(sort);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const activeRaw = s[COST_CRUD_PINNED_ACTIVE_FIELD];
  const is_active =
    activeRaw === true || activeRaw === 'true'
      ? true
      : activeRaw === false || activeRaw === 'false'
        ? false
        : undefined;

  const params: Record<string, string | number | boolean | undefined> = {
    rule_type: pickString(s, 'rule_type'),
    cost_type: pickString(s, 'cost_type'),
    is_active,
    sort_field,
    sort_order,
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
    if (code) params.code = code;
    if (name) params.name = name;
  }

  return params;
}

export function resolveStandardCostListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveCostSort(sort);
  const { date_start: effective_date_start, date_end: effective_date_end } = parseSalesReportDateRange(s, [
    'effective_date_range',
    'effectiveDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const activeRaw = s[COST_CRUD_PINNED_ACTIVE_FIELD];
  const is_active =
    activeRaw === true || activeRaw === 'true'
      ? true
      : activeRaw === false || activeRaw === 'false'
        ? false
        : undefined;

  const params: Record<string, string | number | boolean | undefined> = {
    target_type: pickString(s, 'target_type'),
    cost_item_type: pickString(s, 'cost_item_type'),
    is_active,
    sort_field,
    sort_order,
    effective_date_start,
    effective_date_end,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  const targetId = pickOptionalId(s, 'target_id');
  if (targetId) params.target_id = targetId;

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const targetCode = pickString(s, 'target_code');
    const targetName = pickString(s, 'target_name');
    if (targetCode) params.target_code = targetCode;
    if (targetName) params.target_name = targetName;
  }

  return params;
}
