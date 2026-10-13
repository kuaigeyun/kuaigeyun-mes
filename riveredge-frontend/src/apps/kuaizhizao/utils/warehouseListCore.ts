import type { TFunction } from 'i18next';
import {
  extractProTableSort,
  pickListSearchKeyword,
  pickListSearchKeywordOrFields,
  pickSearchString,
  pickSearchRaw,
  pickSearchTriStateBoolean,
} from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';

export const WAREHOUSE_DOC_PINNED_STATUS_FIELD = 'status';

type InventoryLocationRow = {
  storage_area_name?: string | null;
  location_name?: string | null;
  location_code?: string | null;
};

/** 即时库存 / 批次库存：库区 + 库位名称展示（汇总行 location_name 已为合并文案） */
export function formatInventoryLocationDisplay(row: InventoryLocationRow): string {
  const area = String(row.storage_area_name ?? '').trim();
  const name = String(row.location_name ?? '').trim();
  if (name.includes('、')) return name;
  if (area && name) return `${area} / ${name}`;
  if (name) return name;
  if (area) return area;
  return String(row.location_code ?? '').trim();
}

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

function pickFiniteNumber(
  searchFormValues: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const raw = pickSearchString(searchFormValues, key);
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function pickHubListStatus(searchFormValues?: Record<string, unknown> | null): string | undefined {
  const status = pickSearchString(searchFormValues, 'status');
  if (!status || status === 'all') return undefined;
  return status;
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
  const P = 'app.kuaizhizao.materialBorrow.status';
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
  const docDateKeys = options?.docDateRangeKeys ?? ['doc_date_range', 'docDateRange'];
  const docPrefix = options?.docDateParamPrefix ?? 'doc';
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(searchFormValues ?? {}, docDateKeys);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    reason_type: pickSearchString(searchFormValues, 'reason_type'),
    warehouse_id:
      pickFiniteNumber(searchFormValues, 'warehouse_id'),
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
  const { date_start: stocktaking_date_start, date_end: stocktaking_date_end } = parseSalesReportDateRange(
    searchFormValues ?? {},
    ['stocktaking_date_range', 'stocktakingDateRange'],
  );
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
    stocktaking_type: pickSearchString(searchFormValues, 'stocktaking_type'),
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
  const { date_start: transfer_date_start, date_end: transfer_date_end } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'transfer_date_range',
    'transferDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    from_warehouse_id:
      pickFiniteNumber(searchFormValues, 'from_warehouse_id'),
    to_warehouse_id: pickFiniteNumber(searchFormValues, 'to_warehouse_id'),
    transfer_mode: pickSearchString(searchFormValues, 'transfer_mode'),
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
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(searchFormValues ?? {}, [
    `${dateField}_range`,
    `${dateField}Range`,
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
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
  const { date_start: sent_start_date, date_end: sent_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'sent_date_range',
    'sentDateRange',
  ]);
  const { date_start: planned_delivery_start_date, date_end: planned_delivery_end_date } =
    parseSalesReportDateRange(searchFormValues ?? {}, ['planned_delivery_date_range', 'plannedDeliveryDateRange']);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    customer_id: pickFiniteNumber(searchFormValues, 'customer_id'),
    sales_delivery_id:
      pickFiniteNumber(searchFormValues, 'sales_delivery_id'),
    sales_order_id:
      pickFiniteNumber(searchFormValues, 'sales_order_id'),
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
  const { date_start: registration_start_date, date_end: registration_end_date } =
    parseSalesReportDateRange(searchFormValues ?? {}, ['registration_date_range', 'registrationDateRange']);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    customer_id: pickFiniteNumber(searchFormValues, 'customer_id'),
    registration_date_start: registration_start_date,
    registration_date_end: registration_end_date,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

function resolveCommonDateRanges(searchFormValues?: Record<string, unknown> | null) {
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  return { created_start_date, created_end_date, updated_start_date, updated_end_date };
}

export function resolveInventoryMaterialBalanceListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    material_id: pickFiniteNumber(searchFormValues, 'material_id'),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
  };
}

export function resolveInventoryBatchLineListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    material_id: pickFiniteNumber(searchFormValues, 'material_id'),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
    batch_number: pickSearchString(searchFormValues, 'batch_no'),
  };
}

export function resolveLineSideInventoryListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(searchFormValues);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
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
  const { created_start_date, created_end_date } = resolveCommonDateRanges(searchFormValues);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    created_start_date,
    created_end_date,
  };
}

export function resolveReplenishmentSuggestionListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const { date_start: suggested_order_start_date, date_end: suggested_order_end_date } =
    parseSalesReportDateRange(searchFormValues ?? {}, ['suggested_order_date_range', 'suggestedOrderDateRange']);
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(searchFormValues);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    priority: pickSearchString(searchFormValues, 'priority'),
    suggestion_type:
      pickSearchString(searchFormValues, 'suggestion_type'),
    material_id: pickFiniteNumber(searchFormValues, 'material_id'),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
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
  const { date_start: triggered_start_date, date_end: triggered_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'triggered_at_range',
    'triggeredAtRange',
  ]);
  const { created_start_date, created_end_date } = resolveCommonDateRanges(searchFormValues);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    alert_type: pickSearchString(searchFormValues, 'alert_type'),
    alert_level: pickSearchString(searchFormValues, 'alert_level'),
    material_id: pickFiniteNumber(searchFormValues, 'material_id'),
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
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
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(searchFormValues);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    alert_type: pickSearchString(searchFormValues, 'alert_type'),
    is_enabled: pickSearchTriStateBoolean(searchFormValues, 'is_enabled'),
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
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(searchFormValues);
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    customer_id: pickFiniteNumber(searchFormValues, 'customer_id'),
    is_enabled: pickSearchTriStateBoolean(searchFormValues, 'is_enabled'),
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export type BatchingCenterTaskListRow = {
  task_type?: string;
  product_name?: string | null;
  product_code?: string | null;
  shortage_summary?: string | null;
  material_name?: string | null;
  material_code?: string | null;
};

function trimBatchingDisplayText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 物料中心任务队列「产品/物料」叠列：成品名优先，缺则编码/备料摘要 */
export function resolveBatchingTaskProductMaterialCell(row: BatchingCenterTaskListRow): {
  primary: string;
  secondary: string;
} {
  const productName = trimBatchingDisplayText(row.product_name);
  const productCode = trimBatchingDisplayText(row.product_code);
  const shortage = trimBatchingDisplayText(row.shortage_summary);
  const materialName = trimBatchingDisplayText(row.material_name);
  const materialCode = trimBatchingDisplayText(row.material_code);
  const taskType = trimBatchingDisplayText(row.task_type);

  if (taskType === 'proactive_prep') {
    return {
      primary: productName || productCode || shortage || '-',
      secondary: '-',
    };
  }

  if (taskType === 'batching_draft') {
    const primary = productName || productCode || shortage || '-';
    if (productName || productCode) {
      return { primary, secondary: shortage || '-' };
    }
    return { primary, secondary: '-' };
  }

  const primary = materialName || shortage || '-';
  const secondary = materialCode || '-';
  return { primary, secondary };
}

export function resolveBatchingCenterTaskListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeywordOrFields(searchFormValues, 'work_order_code', 'doc_code'),
    status: pickSearchString(searchFormValues, 'status'),
    priority: pickSearchString(searchFormValues, 'priority'),
    work_order_code: pickSearchString(searchFormValues, 'work_order_code') ?? pickSearchString(searchFormValues, 'doc_code'),
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

export function buildInventoryAlertLevelValueEnum(
  t: TFunction,
): Record<string, { text: string; status: 'error' | 'warning' | 'default' }> {
  return {
    critical: { text: t('app.kuaizhizao.inventoryAlert.alertLevelCritical'), status: 'error' },
    warning: { text: t('app.kuaizhizao.inventoryAlert.alertLevelWarning'), status: 'warning' },
    info: { text: t('app.kuaizhizao.inventoryAlert.alertLevelInfo'), status: 'default' },
  };
}

export function inventoryAlertLevelLabel(
  level: string | null | undefined,
  t: TFunction,
): string {
  const key = String(level ?? '').trim().toLowerCase();
  return buildInventoryAlertLevelValueEnum(t)[key]?.text ?? (level || '—');
}

export function inventoryAlertLevelTagColor(level: string | null | undefined): string {
  const key = String(level ?? '').trim().toLowerCase();
  if (key === 'critical') return 'error';
  if (key === 'warning') return 'warning';
  if (key === 'info') return 'default';
  return 'warning';
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
    case 'receipt_date': {
      const candidates = [
        row.receipt_date,
        row.receipt_time,
        row.receiptTime,
        row.return_time,
        row.registration_date,
        row.created_at,
        row.createdAt,
      ];
      for (const value of candidates) {
        if (value == null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        return value;
      }
      return null;
    }
    case 'delivery_code':
      return row.delivery_code ?? row.picking_code ?? row.outbound_code ?? row.borrow_code;
    case 'delivery_date': {
      const candidates = [
        row.delivery_date,
        row.picking_time,
        row.delivery_time,
        row.borrow_time,
        row.issued_at,
      ];
      for (const value of candidates) {
        if (value == null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        return value;
      }
      return null;
    }
    case 'updated_at':
      return row.updated_at ?? row.updatedAt;
    case 'created_at':
      return row.created_at ?? row.createdAt;
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
    // 缺时间戳一律靠后，避免降序时无 updated_at 的源（如委外驼峰字段）长期占首行
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
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
): Record<string, string | number | readonly string[] | undefined> {
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(searchFormValues);
  const hubScopedReceiptTypesRaw = pickSearchRaw(searchFormValues, 'hub_scoped_receipt_types');
  const hubScopedReceiptTypes = Array.isArray(hubScopedReceiptTypesRaw)
    ? hubScopedReceiptTypesRaw.filter(
        (type): type is string => typeof type === 'string' && type.trim() !== '',
      )
    : undefined;
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeywordOrFields(
      searchFormValues,
      'receipt_code',
      'return_code',
      'inbound_code',
      'registration_code',
      'purchase_order_code',
      'work_order_code',
    ),
    status: pickHubListStatus(searchFormValues),
    receipt_type: pickSearchString(searchFormValues, 'receipt_type'),
    hub_scoped_receipt_types:
      hubScopedReceiptTypes?.length ? hubScopedReceiptTypes : undefined,
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
    supplier_name: pickSearchString(searchFormValues, 'supplier_name'),
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveOutboundHubListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | readonly string[] | undefined> {
  const { created_start_date, created_end_date, updated_start_date, updated_end_date } =
    resolveCommonDateRanges(searchFormValues);
  const hubScopedOutboundTypesRaw = pickSearchRaw(searchFormValues, 'hub_scoped_outbound_types');
  const hubScopedOutboundTypes = Array.isArray(hubScopedOutboundTypesRaw)
    ? hubScopedOutboundTypesRaw.filter(
        (type): type is string => typeof type === 'string' && type.trim() !== '',
      )
    : undefined;
  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeywordOrFields(
      searchFormValues,
      'delivery_code',
      'picking_code',
      'outbound_code',
      'borrow_code',
    ),
    status: pickHubListStatus(searchFormValues),
    outbound_type: pickSearchString(searchFormValues, 'outbound_type'),
    hub_scoped_outbound_types:
      hubScopedOutboundTypes?.length ? hubScopedOutboundTypes : undefined,
    warehouse_id: pickFiniteNumber(searchFormValues, 'warehouse_id'),
    warehouse_name: pickSearchString(searchFormValues, 'warehouse_name'),
    customer_name: pickSearchString(searchFormValues, 'customer_name'),
    total_quantity: pickFiniteNumber(searchFormValues, 'total_quantity'),
    total_items: pickFiniteNumber(searchFormValues, 'total_items'),
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

/** 出库 Hub 合并多源后的字段级筛选（补齐各源 API 未覆盖的条件） */
export function filterOutboundHubRows(
  rows: Record<string, unknown>[],
  params: Record<string, unknown>,
): Record<string, unknown>[] {
  const keyword = typeof params.keyword === 'string' ? params.keyword.trim().toLowerCase() : '';
  const customerName =
    typeof params.customer_name === 'string' ? params.customer_name.trim().toLowerCase() : '';
  const warehouseName =
    typeof params.warehouse_name === 'string' ? params.warehouse_name.trim().toLowerCase() : '';
  const warehouseId =
    params.warehouse_id != null && params.warehouse_id !== ''
      ? Number(params.warehouse_id)
      : undefined;
  const totalQuantity =
    params.total_quantity != null && params.total_quantity !== ''
      ? Number(params.total_quantity)
      : undefined;
  const totalItems =
    params.total_items != null && params.total_items !== ''
      ? Number(params.total_items)
      : undefined;

  return rows.filter((row) => {
    if (keyword) {
      const hay = [
        row.delivery_code,
        row.picking_code,
        row.outbound_code,
        row.borrow_code,
        row.code,
        row.customer_name,
        row.warehouse_name,
        row.sales_order_code,
        row.work_order_code,
        row.source_doc_no,
        row.deliverer_name,
        row.picker_name,
        row.borrower_name,
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      if (!hay.includes(keyword)) return false;
    }
    if (customerName) {
      if (!String(row.customer_name ?? '')
        .toLowerCase()
        .includes(customerName)) {
        return false;
      }
    }
    if (warehouseName) {
      if (!String(row.warehouse_name ?? '')
        .toLowerCase()
        .includes(warehouseName)) {
        return false;
      }
    }
    if (warehouseId != null && Number.isFinite(warehouseId)) {
      if (Number(row.warehouse_id) !== warehouseId) return false;
    }
    if (totalQuantity != null && Number.isFinite(totalQuantity)) {
      if (Number(row.total_quantity) !== totalQuantity) return false;
    }
    if (totalItems != null && Number.isFinite(totalItems)) {
      if (Number(row.total_items) !== totalItems) return false;
    }
    return true;
  });
}

/** 入库 Hub 合并多源后的字段级筛选（补齐各源 API 未覆盖的条件） */
export function filterInboundHubRows(
  rows: Record<string, unknown>[],
  params: Record<string, unknown>,
): Record<string, unknown>[] {
  const keyword = typeof params.keyword === 'string' ? params.keyword.trim().toLowerCase() : '';
  const supplierName =
    typeof params.supplier_name === 'string' ? params.supplier_name.trim().toLowerCase() : '';
  const warehouseId =
    params.warehouse_id != null && params.warehouse_id !== ''
      ? Number(params.warehouse_id)
      : undefined;

  if (!keyword && !supplierName && !(warehouseId != null && Number.isFinite(warehouseId))) {
    return rows;
  }

  return rows.filter((row) => {
    if (keyword) {
      const hay = [
        row.receipt_code,
        row.return_code,
        row.inbound_code,
        row.registration_code,
        row.code,
        row.purchase_order_code,
        row.work_order_code,
        row.sales_order_code,
        row.picking_code,
        row.supplier_name,
        row.customer_name,
        row.warehouse_name,
        row.receiver_name,
        row.returner_name,
        row.outsource_work_order_code,
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      if (!hay.includes(keyword)) return false;
    }
    if (supplierName) {
      if (!String(row.supplier_name ?? '')
        .toLowerCase()
        .includes(supplierName)) {
        return false;
      }
    }
    if (warehouseId != null && Number.isFinite(warehouseId)) {
      if (Number(row.warehouse_id) !== warehouseId) return false;
    }
    return true;
  });
}

export function sortInboundHubRows(rows: Record<string, unknown>[], orderBy?: string) {
  return sortWarehouseHubRows(rows, orderBy, INBOUND_HUB_SORTABLE_FIELDS, '-updated_at');
}

export function sortOutboundHubRows(rows: Record<string, unknown>[], orderBy?: string) {
  return sortWarehouseHubRows(rows, orderBy, OUTBOUND_HUB_SORTABLE_FIELDS, '-updated_at');
}
