import type { TFunction } from 'i18next';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';

export const WAREHOUSE_DOC_PINNED_STATUS_FIELD = 'status';

export function normalizeWarehouseListResponse(res: unknown): { data: unknown[]; total: number } {
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

export function buildOtherInboundStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.warehouseOtherInbound.status';
  return {
    待入库: { text: t(`${P}.pending`) },
    已入库: { text: t(`${P}.posted`) },
    已取消: { text: t(`${P}.cancelled`) },
  };
}

export function buildOtherOutboundStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.warehouseOtherOutbound.status';
  return {
    待出库: { text: t(`${P}.pending`) },
    已出库: { text: t(`${P}.posted`) },
    已取消: { text: t(`${P}.cancelled`) },
  };
}

export function buildMaterialBorrowStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.warehouseMaterialBorrow.status';
  return {
    待借出: { text: t(`${P}.pending`) },
    已借出: { text: t(`${P}.borrowed`) },
    已取消: { text: t(`${P}.cancelled`) },
  };
}

export function buildMaterialReturnStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.warehouseMaterialReturn.status';
  return {
    待归还: { text: t(`${P}.pending`) },
    已归还: { text: t(`${P}.returned`) },
    已取消: { text: t(`${P}.cancelled`) },
  };
}

export function buildCustomerMaterialRegistrationStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    pending: { text: t('app.kuaizhizao.warehouseCommon.statusPendingInbound') },
    processed: { text: t('app.kuaizhizao.warehouseCommon.statusInbound') },
    cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled') },
  };
}

export function resolveWarehouseDocListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: {
    docDateRangeKeys?: [string, string];
    docDateParamPrefix?: string;
  },
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const docDateKeys = options?.docDateRangeKeys ?? ['doc_date_range', 'docDateRange'];
  const docPrefix = options?.docDateParamPrefix ?? 'doc';
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(s, docDateKeys);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    reason_type: typeof s.reason_type === 'string' && s.reason_type ? s.reason_type : undefined,
    warehouse_id:
      s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
  if (docStart) params[`${docPrefix}_start_date`] = docStart;
  if (docEnd) params[`${docPrefix}_end_date`] = docEnd;
  return params;
}

export function buildDeliveryNoticeStatusValueEnum(): Record<string, { text: string }> {
  return {
    待发送: { text: '待发送' },
    已发送: { text: '已发送' },
    已签收: { text: '已签收' },
  };
}

export function buildWarehouseWorkflowStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    draft: { text: t('app.kuaizhizao.warehouseCommon.statusDraft') },
    in_progress: { text: t('app.kuaizhizao.warehouseCommon.statusInProgress') },
    completed: { text: t('app.kuaizhizao.warehouseCommon.statusCompleted') },
    cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled') },
  };
}

export function buildStocktakingTypeValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    full: { text: t('app.kuaizhizao.stocktaking.typeFull') },
    partial: { text: t('app.kuaizhizao.stocktaking.typePartial') },
    cycle: { text: t('app.kuaizhizao.stocktaking.typeCycle') },
  };
}

export function buildInventoryTransferModeValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    transfer: { text: t('app.kuaizhizao.inventoryTransfer.transferModeCross') },
    bin_relocation: { text: t('app.kuaizhizao.inventoryTransfer.transferModeBinRelocation') },
  };
}

export function resolveStocktakingListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: stocktaking_date_start, date_end: stocktaking_date_end } = parseSalesReportDateRange(
    s,
    ['stocktaking_date_range', 'stocktakingDateRange'],
  );
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    stocktaking_type: typeof s.stocktaking_type === 'string' && s.stocktaking_type ? s.stocktaking_type : undefined,
    stocktaking_date_start,
    stocktaking_date_end,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveInventoryTransferListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: transfer_date_start, date_end: transfer_date_end } = parseSalesReportDateRange(s, [
    'transfer_date_range',
    'transferDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    from_warehouse_id:
      s.from_warehouse_id != null && s.from_warehouse_id !== '' ? Number(s.from_warehouse_id) : undefined,
    to_warehouse_id: s.to_warehouse_id != null && s.to_warehouse_id !== '' ? Number(s.to_warehouse_id) : undefined,
    transfer_mode: typeof s.transfer_mode === 'string' && s.transfer_mode ? s.transfer_mode : undefined,
    transfer_date_start,
    transfer_date_end,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveAssemblyDisassemblyOrderListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { dateField?: 'assembly_date' | 'disassembly_date' },
): Record<string, string | number | undefined> {
  const dateField = options?.dateField ?? 'assembly_date';
  const s = searchFormValues ?? {};
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(s, [
    `${dateField}_range`,
    `${dateField}Range`,
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
  if (docStart) params[`${dateField}_start`] = docStart;
  if (docEnd) params[`${dateField}_end`] = docEnd;
  return params;
}

export function resolveDeliveryNoticeListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: sent_start_date, date_end: sent_end_date } = parseSalesReportDateRange(s, [
    'sent_date_range',
    'sentDateRange',
  ]);
  const { date_start: planned_delivery_start_date, date_end: planned_delivery_end_date } =
    parseSalesReportDateRange(s, ['planned_delivery_date_range', 'plannedDeliveryDateRange']);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    customer_id: s.customer_id != null && s.customer_id !== '' ? Number(s.customer_id) : undefined,
    sales_delivery_id:
      s.sales_delivery_id != null && s.sales_delivery_id !== '' ? Number(s.sales_delivery_id) : undefined,
    sales_order_id:
      s.sales_order_id != null && s.sales_order_id !== '' ? Number(s.sales_order_id) : undefined,
    sent_start_date,
    sent_end_date,
    planned_delivery_start_date,
    planned_delivery_end_date,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveCustomerMaterialRegistrationListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: registration_start_date, date_end: registration_end_date } =
    parseSalesReportDateRange(s, ['registration_date_range', 'registrationDateRange']);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    customer_id: s.customer_id != null && s.customer_id !== '' ? Number(s.customer_id) : undefined,
    registration_date_start: registration_start_date,
    registration_date_end: registration_end_date,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

function resolveCommonDateRanges(searchFormValues?: Record<string, unknown> | null) {
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

export function resolveInventoryMaterialBalanceListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    material_id: s.material_id != null && s.material_id !== '' ? Number(s.material_id) : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
  };
}

export function resolveInventoryBatchLineListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    material_id: s.material_id != null && s.material_id !== '' ? Number(s.material_id) : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    batch_number: pickString(s, 'batch_no'),
  };
}

export function resolveLineSideInventoryListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveBackflushRecordListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { created_start_date, created_end_date } = resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    created_start_date,
    created_end_date,
  };
}

export function resolveReplenishmentSuggestionListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: suggested_order_start_date, date_end: suggested_order_end_date } =
    parseSalesReportDateRange(s, ['suggested_order_date_range', 'suggestedOrderDateRange']);
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    priority: typeof s.priority === 'string' && s.priority ? s.priority : undefined,
    suggestion_type:
      typeof s.suggestion_type === 'string' && s.suggestion_type ? s.suggestion_type : undefined,
    material_id: s.material_id != null && s.material_id !== '' ? Number(s.material_id) : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    suggested_order_start_date,
    suggested_order_end_date,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveInventoryAlertListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: triggered_start_date, date_end: triggered_end_date } = parseSalesReportDateRange(s, [
    'triggered_at_range',
    'triggeredAtRange',
  ]);
  const { created_start_date, created_end_date } = resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    alert_type: typeof s.alert_type === 'string' && s.alert_type ? s.alert_type : undefined,
    alert_level: typeof s.alert_level === 'string' && s.alert_level ? s.alert_level : undefined,
    material_id: s.material_id != null && s.material_id !== '' ? Number(s.material_id) : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    triggered_start_date,
    triggered_end_date,
    created_start_date,
    created_end_date,
  };
}

export function resolveInventoryAlertRuleListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    alert_type: typeof s.alert_type === 'string' && s.alert_type ? s.alert_type : undefined,
    is_enabled:
      s.is_enabled === true || s.is_enabled === false
        ? s.is_enabled
        : s.is_enabled === 'true'
          ? true
          : s.is_enabled === 'false'
            ? false
            : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveBarcodeMappingRuleListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    customer_id: s.customer_id != null && s.customer_id !== '' ? Number(s.customer_id) : undefined,
    is_enabled:
      s.is_enabled === true || s.is_enabled === false
        ? s.is_enabled
        : s.is_enabled === 'true'
          ? true
          : s.is_enabled === 'false'
            ? false
            : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveBatchingCenterTaskListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword') ?? pickString(s, 'work_order_code') ?? pickString(s, 'doc_code'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    priority: typeof s.priority === 'string' && s.priority ? s.priority : undefined,
    work_order_code: pickString(s, 'work_order_code') ?? pickString(s, 'doc_code'),
  };
}

export function buildReplenishmentSuggestionStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending') },
    processed: { text: t('app.kuaizhizao.replenishmentSuggestions.statusProcessed') },
    ignored: { text: t('app.kuaizhizao.warehouseCommon.statusIgnored') },
  };
}

export function buildInventoryAlertStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending') },
    resolved: { text: t('app.kuaizhizao.warehouseCommon.statusResolved') },
    ignored: { text: t('app.kuaizhizao.warehouseCommon.statusIgnored') },
  };
}

export function buildBackflushRecordStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending') },
    completed: { text: t('app.kuaizhizao.warehouseCommon.statusCompleted') },
    failed: { text: t('app.kuaizhizao.backflushRecords.statusFailed') },
    cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled') },
  };
}

export function buildInboundHubStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    pending: { text: t('app.kuaizhizao.warehouseInbound.filter.status.pending') },
    posted: { text: t('app.kuaizhizao.warehouseInbound.filter.status.posted') },
    all: { text: t('app.kuaizhizao.warehouseInbound.filter.status.all') },
  };
}

export function buildOutboundHubStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.warehouseOtherOutbound.status';
  return {
    pending: { text: t(`${P}.pending`) },
    posted: { text: t(`${P}.posted`) },
    all: { text: t('app.kuaizhizao.warehouseInbound.filter.status.all') },
  };
}

const INBOUND_HUB_SORTABLE_FIELDS = new Set([
  'receipt_code',
  'return_code',
  'receipt_type',
  'total_quantity',
  'total_items',
  'warehouse_name',
  'receipt_date',
  'updated_at',
  'created_at',
  'supplier_name',
]);

const OUTBOUND_HUB_SORTABLE_FIELDS = new Set([
  'delivery_code',
  'picking_code',
  'outbound_type',
  'total_quantity',
  'total_items',
  'warehouse_name',
  'delivery_date',
  'updated_at',
  'created_at',
  'customer_name',
]);

function hubSortValue(row: Record<string, unknown>, field: string): unknown {
  switch (field) {
    case 'receipt_code':
      return row.receipt_code ?? row.return_code ?? row.inbound_code ?? row.registration_code;
    case 'receipt_date':
      return row.receipt_date ?? row.return_time ?? row.created_at;
    case 'delivery_code':
      return row.delivery_code ?? row.picking_code ?? row.outbound_code ?? row.borrow_code;
    default:
      return row[field];
  }
}

function sortWarehouseHubRows(
  rows: Record<string, unknown>[],
  orderBy: string | undefined,
  allowedFields: Set<string>,
  defaultOrder: string,
): Record<string, unknown>[] {
  const rawField = (orderBy || defaultOrder).replace(/^-/, '');
  const orderClause =
    orderBy && allowedFields.has(rawField) ? orderBy : defaultOrder;
  const reverse = orderClause.startsWith('-');
  const field = orderClause.replace(/^-/, '');
  if (!allowedFields.has(field)) {
    return rows;
  }
  const numericFields = new Set(['total_quantity', 'total_items']);
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = hubSortValue(a, field);
    const bv = hubSortValue(b, field);
    if (av == null && bv == null) return 0;
    if (av == null) return reverse ? -1 : 1;
    if (bv == null) return reverse ? 1 : -1;
    if (numericFields.has(field)) {
      const an = Number(av);
      const bn = Number(bv);
      return reverse ? bn - an : an - bn;
    }
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as < bs) return reverse ? 1 : -1;
    if (as > bs) return reverse ? -1 : 1;
    return 0;
  });
  return sorted;
}

export function resolveInboundHubListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status && s.status !== 'all' ? s.status : undefined,
    receipt_type: typeof s.receipt_type === 'string' && s.receipt_type ? s.receipt_type : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    supplier_name: pickString(s, 'supplier_name'),
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveOutboundHubListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(s);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status && s.status !== 'all' ? s.status : undefined,
    outbound_type: typeof s.outbound_type === 'string' && s.outbound_type ? s.outbound_type : undefined,
    warehouse_id: s.warehouse_id != null && s.warehouse_id !== '' ? Number(s.warehouse_id) : undefined,
    customer_name: pickString(s, 'customer_name'),
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function sortInboundHubRows(rows: Record<string, unknown>[], orderBy?: string) {
  return sortWarehouseHubRows(rows, orderBy, INBOUND_HUB_SORTABLE_FIELDS, '-updated_at');
}

export function sortOutboundHubRows(rows: Record<string, unknown>[], orderBy?: string) {
  return sortWarehouseHubRows(rows, orderBy, OUTBOUND_HUB_SORTABLE_FIELDS, '-updated_at');
}
