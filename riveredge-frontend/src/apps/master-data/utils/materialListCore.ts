import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import { UniTableStackedPrimaryCell } from '../../../components/uni-table/stackedPrimaryColumn';
import {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  masterCrudCreatedUpdatedColumns,
  pickOptionalString,
} from './masterListCore';

export { formatMasterDateTimeCell, buildMasterCrudActiveValueEnum, masterCrudCreatedUpdatedColumns };
export { MASTER_CRUD_PINNED_ACTIVE_FIELD, MASTER_DATA_LIST_FIELD_RANK, GLOBAL_DOC_LIST_FIELD_RANK } from './masterListCore';

/** @deprecated 列序唯一真源 GLOBAL_DOC_LIST_FIELD_RANK；别名仅兼容旧 import。 */
export { GLOBAL_DOC_LIST_FIELD_RANK as BATCH_SERIAL_LEDGER_LIST_FIELD_RANK } from '../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

export const MATERIAL_PINNED_ACTIVE_FIELD = 'isActive';
export const VARIANT_ATTRIBUTE_PINNED_ACTIVE_FIELD = 'is_active';

const RULE_LIST_SORT_MAP: Record<string, string> = {
  name: 'name',
  code: 'code',
  description: 'description',
  seqResetRule: 'seq_reset_rule',
  isActive: 'is_active',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const MATERIAL_LIST_SORT_MAP: Record<string, string> = {
  mainCode: 'main_code',
  name: 'name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const VARIANT_ATTR_SORT_MAP: Record<string, string> = {
  display_order: 'display_order',
  attribute_name: 'attribute_name',
  display_name: 'display_name',
  created_at: 'created_at',
  updated_at: 'updated_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const BATCH_SERIAL_SORT_MAP: Record<string, string> = {
  batchNo: 'batch_no',
  serialNo: 'serial_no',
  materialCode: 'material_code',
  materialName: 'material_name',
  materialModel: 'material_model',
  quantity: 'quantity',
  status: 'status',
  productionDate: 'production_date',
  expiryDate: 'expiry_date',
  factoryDate: 'factory_date',
  createdAt: 'created_at',
};

function pickString(search: Record<string, unknown>, key: string) {
  const v = search[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolveActiveBoolean(
  search: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const raw = search[field];
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return undefined;
}

function resolveMaterialOperatorName(record: Record<string, unknown>, key: 'created' | 'updated'): string {
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

export function resolveRuleListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sort_by = sortBy ? RULE_LIST_SORT_MAP[sortBy] ?? sortBy : undefined;
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    is_active: resolveActiveBoolean(s, 'isActive'),
    sort_by,
    sort_order: sortOrder,
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

export function masterRuleCodeNameSearchColumns(
  labels: { code: string; name: string },
): ProColumns[] {
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

export function resolveMaterialListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: {
    groupId?: number | null;
    noGroup?: boolean;
  },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sortKey = sortBy ? MATERIAL_LIST_SORT_MAP[sortBy] ?? sortBy : undefined;
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    isActive: resolveActiveBoolean(s, 'isActive'),
    sortBy: sortKey,
    sortOrder,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  if (options?.noGroup) {
    params.noGroup = true;
  } else if (options?.groupId != null) {
    params.groupId = options.groupId;
  }

  const searchGroupId = s.groupId;
  if (searchGroupId != null && searchGroupId !== '') {
    params.groupId = Number(searchGroupId);
    delete params.noGroup;
  }

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const code = pickString(s, 'code') ?? pickString(s, 'mainCode');
    const name = pickString(s, 'name');
    if (code) params.code = code;
    if (name) params.name = name;
  }

  const sourceType = pickOptionalString(s, 'sourceType');
  if (sourceType) params.sourceType = sourceType;
  const specification = pickString(s, 'specification');
  if (specification) params.specification = specification;
  const brand = pickString(s, 'brand');
  if (brand) params.brand = brand;
  const model = pickString(s, 'model');
  if (model) params.model = model;
  const baseUnit = pickOptionalString(s, 'baseUnit');
  if (baseUnit) params.baseUnit = baseUnit;

  return params;
}

export function resolveVariantAttributeListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sort_by = sortBy ? VARIANT_ATTR_SORT_MAP[sortBy] ?? sortBy : undefined;
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    is_active: resolveActiveBoolean(s, 'is_active'),
    attribute_type: pickOptionalString(s, 'attribute_type'),
    sort_by,
    sort_order: sortOrder,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const attribute_name = pickString(s, 'attribute_name');
    const display_name = pickString(s, 'display_name');
    if (attribute_name) params.attribute_name = attribute_name;
    if (display_name) params.display_name = display_name;
  }

  return params;
}

export function variantAttributeCodeNameSearchColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.master-data.variantAttributes.attributeName'),
      dataIndex: 'attribute_name',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: t('app.master-data.variantAttributes.displayName'),
      dataIndex: 'display_name',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function masterCrudCreatedOnlyColumns<
  T extends Record<string, unknown>,
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 156,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        React.createElement(UniTableStackedPrimaryCell, {
          primary: resolveMaterialOperatorName(r as Record<string, unknown>, 'created'),
          secondary: formatMasterDateTimeCell((r as Record<string, unknown>).createdAt ?? (r as Record<string, unknown>).created_at),
          secondaryCopyable: false,
          primaryBold: false,
        }),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 30,
      formItemProps: formDateRangeFormItemProps,
    },
  ];
}

export function masterCrudCreatedUpdatedSnakeColumns<
  T extends Record<string, unknown>,
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 148,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => {
        const preferred = resolveMaterialPreferredAudit(r as Record<string, unknown>);
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

function resolveMaterialPreferredAudit(record: Record<string, unknown>): { operator: string; time: string } {
  const updatedOperator = resolveMaterialOperatorName(record, 'updated');
  const updatedTime = formatMasterDateTimeCell(record.updated_at ?? record.updatedAt);
  if (updatedOperator !== '-' && updatedTime !== '-') {
    return {
      operator: updatedOperator,
      time: updatedTime,
    };
  }
  const createdOperator = resolveMaterialOperatorName(record, 'created');
  const createdTime = formatMasterDateTimeCell(record.created_at ?? record.createdAt);
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

/**
 * 批号/序列号台账列表列序：已并入 GLOBAL_DOC_LIST_FIELD_RANK（见 documentFieldAlignment）。
 * @deprecated 使用 GLOBAL_DOC_LIST_FIELD_RANK / BATCH_SERIAL_LEDGER_LIST_FIELD_RANK 别名。
 */

export function batchSerialLedgerNoSearchColumn(
  title: string,
  dataIndex: 'batchNo' | 'serialNo',
): ProColumns {
  return {
    title,
    dataIndex,
    hideInTable: true,
    order: 10,
    fieldProps: { allowClear: true },
  };
}

export function resolveBatchSerialLedgerListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { batchNoField?: string; serialNoField?: string },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const batchNoField = options?.batchNoField ?? 'batchNo';
  const serialNoField = options?.serialNoField ?? 'serialNo';
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sort_by = sortBy ? BATCH_SERIAL_SORT_MAP[sortBy] ?? sortBy : undefined;
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    status: pickOptionalString(s, 'status'),
    sort_by,
    sort_order: sortOrder,
    created_start_date,
    created_end_date,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const batchNo = pickString(s, batchNoField);
    const serialNo = pickString(s, serialNoField);
    if (batchNo) params.batch_no = batchNo;
    if (serialNo) params.serial_no = serialNo;
  }

  return params;
}
