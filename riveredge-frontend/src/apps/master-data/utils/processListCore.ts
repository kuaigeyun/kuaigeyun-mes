import type { ProColumns } from '@ant-design/pro-components';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  pickOptionalString,
} from './masterListCore';
import { masterCrudCreatedUpdatedSnakeColumns } from './materialListCore';

export {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  masterCrudCreatedUpdatedSnakeColumns,
};

export const PROCESS_ROUTE_PINNED_ACTIVE_FIELD = 'is_active';

const PROCESS_LIST_SORT_MAP: Record<string, string> = {
  code: 'code',
  name: 'name',
  category: 'category',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  isActive: 'is_active',
  is_active: 'is_active',
  reportingType: 'reporting_type',
  operationId: 'operation_id',
  version: 'version',
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

export function resolveProcessListParams(
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
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sortKey = sortBy ? PROCESS_LIST_SORT_MAP[sortBy] ?? sortBy : undefined;
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    isActive: resolveActiveBoolean(s, activeField),
    sortBy: sortKey,
    sortOrder,
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

export function resolveSopListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  return resolveProcessListParams(searchFormValues, sort, {
    extra: (search) => {
      const extra: Record<string, string | number | boolean | undefined> = {};
      const operationId = search.operationId;
      if (operationId != null && operationId !== '') {
        extra.operationId = Number(operationId);
      }
      const materialUuid = pickOptionalString(search, 'material_uuid');
      if (materialUuid) extra.material_uuid = materialUuid;
      const materialGroupUuid = pickOptionalString(search, 'material_group_uuid');
      if (materialGroupUuid) extra.material_group_uuid = materialGroupUuid;
      const routeUuid = pickOptionalString(search, 'route_uuid');
      if (routeUuid) extra.route_uuid = routeUuid;
      return extra;
    },
  });
}

export function processRouteActiveSearchColumn(
  title: string,
  valueEnum: Record<string, { text: string }>,
): ProColumns {
  return {
    title,
    dataIndex: 'is_active',
    hideInTable: true,
    order: 20,
    valueType: 'select',
    valueEnum,
    fieldProps: { allowClear: true },
  };
}
