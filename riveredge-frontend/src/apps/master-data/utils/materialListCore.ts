import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  masterCrudCreatedUpdatedColumns,
  pickOptionalString,
} from './masterListCore';

export { formatMasterDateTimeCell, buildMasterCrudActiveValueEnum, masterCrudCreatedUpdatedColumns };
export { MASTER_CRUD_PINNED_ACTIVE_FIELD } from './masterListCore';

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
  T extends { createdAt?: string; created_at?: string },
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatMasterDateTimeCell(r.createdAt ?? r.created_at),
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
  T extends { created_at?: string; updated_at?: string },
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatMasterDateTimeCell(r.created_at),
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
      dataIndex: 'updated_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatMasterDateTimeCell(r.updated_at),
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
