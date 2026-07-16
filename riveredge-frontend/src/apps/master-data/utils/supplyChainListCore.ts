import type { ProColumns } from '@ant-design/pro-components';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  pickOptionalString,
} from './masterListCore';

export {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
};

/** @deprecated 列序唯一真源 GLOBAL_DOC_LIST_FIELD_RANK；别名仅兼容旧 import。 */
export {
  GLOBAL_DOC_LIST_FIELD_RANK as PARTNER_LIST_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK as PARTNER_PRICE_BOOK_LIST_FIELD_RANK,
} from '../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

const SUPPLY_CHAIN_SORT_MAP: Record<string, string> = {
  code: 'code',
  name: 'name',
  category: 'category',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  isActive: 'is_active',
  shortName: 'short_name',
  contactPerson: 'contact_person',
  salesmanName: 'salesman_name',
  buyerName: 'buyer_name',
  industryCode: 'industry_code',
  customerLevelCode: 'customer_level_code',
  leadSourceCode: 'lead_source_code',
  sourceChannelCode: 'source_channel_code',
  estimatedAnnualPurchase: 'estimated_annual_purchase',
  creditLimit: 'credit_limit',
  contactTitle: 'contact_title',
};

const PRICE_BOOK_SORT_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  isActive: 'is_active',
  unitPrice: 'unit_price',
  effectiveFrom: 'effective_from',
  effectiveTo: 'effective_to',
  partnerName: 'updated_at',
  materialName: 'updated_at',
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

function resolveSupplyChainListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: {
    extra?: (search: Record<string, unknown>) => Record<string, string | number | boolean | undefined>;
  },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sortKey = sortBy ? SUPPLY_CHAIN_SORT_MAP[sortBy] ?? sortBy : undefined;
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

export function resolveCustomerListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  return resolveSupplyChainListParams(searchFormValues, sort, {
    extra: (search) => {
      const extra: Record<string, string | number | boolean | undefined> = {};
      const category = pickOptionalString(search, 'category');
      if (category) extra.category = category;
      const salesmanId = search.salesmanId;
      if (salesmanId != null && salesmanId !== '') {
        extra.salesmanId = Number(salesmanId);
      }
      return extra;
    },
  });
}

export function resolveSupplierListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  return resolveSupplyChainListParams(searchFormValues, sort, {
    extra: (search) => {
      const extra: Record<string, string | number | boolean | undefined> = {};
      const category = pickOptionalString(search, 'category');
      if (category) extra.category = category;
      const buyerId = search.buyerId;
      if (buyerId != null && buyerId !== '') {
        extra.buyerId = Number(buyerId);
      }
      return extra;
    },
  });
}

export function resolvePartnerPriceBookListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const sortKey = sortBy ? PRICE_BOOK_SORT_MAP[sortBy] ?? sortBy : undefined;
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    activeOnly: resolveActiveBoolean(s, 'isActive'),
    sortBy: sortKey,
    sortOrder,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  const partnerId = s.partnerId;
  if (partnerId != null && partnerId !== '') {
    params.partnerId = Number(partnerId);
  }
  const materialId = s.materialId;
  if (materialId != null && materialId !== '') {
    params.materialId = Number(materialId);
  }

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  }

  const effectiveOn = pickString(s, 'effectiveOn');
  if (effectiveOn) params.effectiveOn = effectiveOn;

  return params;
}

export function partnerPriceBookPartnerSearchColumn(
  title: string,
  options: { label: string; value: number }[],
): ProColumns {
  return {
    title,
    dataIndex: 'partnerId',
    hideInTable: true,
    order: 10,
    valueType: 'select',
    fieldProps: {
      options,
      showSearch: true,
      optionFilterProp: 'label',
      allowClear: true,
    },
  };
}
