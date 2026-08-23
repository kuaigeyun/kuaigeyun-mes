import type { TFunction } from 'i18next';
import type { InboundHubOrder, InboundReceiptType } from './inboundHubTypes';
import { resolveInboundHubDateRaw, resolveInboundHubOperator } from './inboundHubTypes';

type InboundDetailItem = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  unit?: string;
  receipt_quantity?: number;
  inbound_quantity?: number;
  return_quantity?: number;
  quantity?: number;
  warehouse_name?: string;
  location_code?: string;
  batch_number?: string;
  qualified_quantity?: number;
  unqualified_quantity?: number;
};

/** Hub 明细行数量：采购/成品用 receipt_quantity，其他入库用 inbound_quantity 等 */
export function resolveInboundHubLineQuantity(row: Record<string, unknown> | InboundDetailItem): number | undefined {
  const raw =
    row.receipt_quantity ??
    row.inbound_quantity ??
    row.return_quantity ??
    row.quantity;
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeInboundHubDetailItem(item: Record<string, unknown>): InboundDetailItem {
  const qty = resolveInboundHubLineQuantity(item);
  return {
    ...(item as InboundDetailItem),
    ...(qty != null ? { receipt_quantity: qty } : {}),
  };
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

function mapOutsourceStatus(rawStatus: unknown): string {
  const status = String(rawStatus ?? '').trim();
  if (status === 'draft') return '草稿';
  if (status === 'completed') return '已入库';
  if (status === 'cancelled') return '已取消';
  return status;
}

function mapCustomerMaterialStatus(rawStatus: unknown): string {
  const status = String(rawStatus ?? '').trim();
  if (status === 'pending') return '待入库';
  if (status === 'processed') return '已入库';
  return status;
}

/** 详情 API 原始响应 → Hub 统一字段（与列表 aggregate 对齐） */
export function normalizeInboundHubDetail(
  receiptType: InboundReceiptType,
  raw: Record<string, unknown>,
  listRow?: InboundHubOrder,
): InboundHubOrder {
  const row: Record<string, unknown> = { ...raw, receipt_type: receiptType };

  switch (receiptType) {
    case 'production_return':
      row.receipt_code = pickString(row, 'receipt_code', 'return_code') ?? listRow?.receipt_code;
      row.return_code = pickString(row, 'return_code', 'receipt_code') ?? listRow?.return_code;
      break;
    case 'customer_material':
      row.receipt_code =
        pickString(row, 'receipt_code', 'registration_code', 'code') ?? listRow?.receipt_code;
      row.registration_code = pickString(row, 'registration_code', 'receipt_code') ?? listRow?.registration_code;
      row.status = mapCustomerMaterialStatus(row.status ?? listRow?.status);
      row.receipt_date = row.receipt_date ?? row.registration_date ?? listRow?.receipt_date;
      row.received_by =
        pickString(row, 'processed_by_name', 'registered_by_name', 'received_by') ??
        listRow?.received_by;
      break;
    case 'sales_return':
      row.receipt_code = pickString(row, 'receipt_code', 'return_code') ?? listRow?.receipt_code;
      row.return_code = pickString(row, 'return_code', 'receipt_code') ?? listRow?.return_code;
      row.total_quantity =
        row.total_quantity ?? row.total_return_quantity ?? listRow?.total_quantity;
      break;
    case 'other_inbound':
      row.receipt_code = pickString(row, 'receipt_code', 'inbound_code', 'code') ?? listRow?.receipt_code;
      break;
    case 'material_return':
      row.receipt_code = pickString(row, 'receipt_code', 'return_code') ?? listRow?.receipt_code;
      row.return_code = pickString(row, 'return_code', 'receipt_code') ?? listRow?.return_code;
      row.total_quantity =
        row.total_quantity ?? row.total_return_quantity ?? listRow?.total_quantity;
      break;
    case 'outsource_receipt': {
      const receivedAt = row.received_at ?? row.receivedAt ?? listRow?.received_at;
      const operatorName =
        pickString(row, 'received_by_name', 'receivedByName', 'created_by_name', 'createdByName') ??
        (typeof listRow?.received_by_name === 'string' ? listRow.received_by_name : undefined);
      row.receipt_code = pickString(row, 'receipt_code', 'code') ?? listRow?.receipt_code;
      row.outsource_work_order_code =
        pickString(row, 'outsource_work_order_code', 'outsourceWorkOrderCode') ??
        listRow?.outsource_work_order_code;
      row.total_quantity = row.total_quantity ?? row.quantity ?? listRow?.total_quantity;
      row.received_at = receivedAt;
      row.receipt_date = receivedAt ?? row.receipt_date ?? listRow?.receipt_date;
      row.received_by_name = operatorName;
      row.received_by = operatorName;
      row.status = mapOutsourceStatus(row.status ?? listRow?.status);
      break;
    }
    case 'outsource_material_return':
    case 'outsource_product_return': {
      const returnedAt = row.returned_at ?? row.returnedAt ?? listRow?.returned_at;
      const operatorName =
        pickString(row, 'returned_by_name', 'returnedByName', 'created_by_name', 'createdByName') ??
        (typeof listRow?.returned_by_name === 'string' ? listRow.returned_by_name : undefined);
      row.receipt_code = pickString(row, 'receipt_code', 'code') ?? listRow?.receipt_code;
      row.outsource_work_order_code =
        pickString(row, 'outsource_work_order_code', 'outsourceWorkOrderCode') ??
        listRow?.outsource_work_order_code;
      row.total_quantity = row.total_quantity ?? row.quantity ?? listRow?.total_quantity;
      row.returned_at = returnedAt;
      row.receipt_date = returnedAt ?? row.receipt_date ?? listRow?.receipt_date;
      row.returned_by_name = operatorName;
      row.received_by = operatorName;
      row.status = mapOutsourceStatus(row.status ?? listRow?.status);
      break;
    }
    default:
      row.receipt_code =
        pickString(row, 'receipt_code', 'return_code', 'inbound_code', 'registration_code', 'code') ??
        listRow?.receipt_code;
      break;
  }

  if (listRow) {
    if (!row.receipt_code) row.receipt_code = listRow.receipt_code;
    if (!row.return_code) row.return_code = listRow.return_code;
    if (!row.warehouse_name) row.warehouse_name = listRow.warehouse_name;
    if (!row.status) row.status = listRow.status;
    if (!row.received_by_name) row.received_by_name = listRow.received_by_name;
    if (!row.received_at) row.received_at = listRow.received_at;
    if (!row.receipt_date) row.receipt_date = listRow.receipt_date;
  }

  if (Array.isArray(row.items)) {
    row.items = row.items.map((it) =>
      normalizeInboundHubDetailItem(
        typeof it === 'object' && it != null ? (it as Record<string, unknown>) : {},
      ),
    );
  }

  const dateRaw = resolveInboundHubDateRaw(row as InboundHubOrder);
  const operator = resolveInboundHubOperator(row as InboundHubOrder);
  return {
    ...(row as InboundHubOrder),
    ...(dateRaw != null && String(dateRaw).trim() !== '' ? { receipt_date: String(dateRaw) } : {}),
    ...(operator ? { received_by: operator, received_by_name: operator } : {}),
  };
}

export function resolveInboundHubStatusLabel(
  t: TFunction,
  status?: string,
  receiptType?: InboundReceiptType,
): string {
  const raw = String(status ?? '').trim();
  if (!raw) return '-';
  const lower = raw.toLowerCase();

  const postedLike =
    receiptType === 'outsource_receipt' ||
    receiptType === 'outsource_material_return' ||
    receiptType === 'customer_material';

  const map: Record<string, string> = {
    draft: t('app.kuaizhizao.warehouseCommon.statusDraft'),
    pending: t('app.kuaizhizao.warehouseCommon.statusPendingInbound'),
    processed: t('app.kuaizhizao.warehouseCommon.statusInbound'),
    completed: postedLike
      ? t('app.kuaizhizao.warehouseCommon.statusInbound')
      : t('app.kuaizhizao.warehouseCommon.statusCompleted'),
    cancelled: t('app.kuaizhizao.warehouseCommon.statusCancelled'),
    草稿: t('app.kuaizhizao.warehouseCommon.statusDraft'),
    待入库: t('app.kuaizhizao.warehouseCommon.statusPendingInbound'),
    已确认: t('app.kuaizhizao.warehouseCommon.statusInProgress'),
    已完成: t('app.kuaizhizao.warehouseCommon.statusCompleted'),
    已入库: t('app.kuaizhizao.warehouseCommon.statusInbound'),
    已取消: t('app.kuaizhizao.warehouseCommon.statusCancelled'),
    待退料: t('app.kuaizhizao.warehouseCommon.statusPendingInbound'),
    已退料: t('lifecycle.stage.returned'),
    已退货: t('app.kuaizhizao.salesReturn.statusReturned'),
    已归还: t('app.kuaizhizao.warehouseMaterialReturn.status.returned'),
    待收货: t('app.kuaizhizao.warehouseCommon.statusPendingInbound'),
  };

  return map[raw] ?? map[lower] ?? raw;
}

export function resolveInboundHubStatusTagColor(status?: string): string {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();
  if (
    ['已入库', '已退货', '已退料', '已归还', '已完成', 'processed'].includes(raw) ||
    lower === 'completed' ||
    lower === 'posted'
  ) {
    return 'success';
  }
  if (['已确认', '待退料', '待入库', '待收货', 'pending'].includes(raw) || lower === 'pending') {
    return 'processing';
  }
  if (raw === '已取消' || lower === 'cancelled') return 'error';
  return 'default';
}

/** 单行委外类单据等无 items 数组时，合成明细行供抽屉展示 */
export function resolveInboundHubDetailItems(order: InboundHubOrder): InboundDetailItem[] {
  const existing = order.items;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing as InboundDetailItem[];
  }

  const row = order as Record<string, unknown>;
  const type = order.receipt_type;

  if (
    type === 'outsource_receipt' ||
    type === 'outsource_material_return' ||
    type === 'outsource_product_return'
  ) {
    const qty = Number(row.quantity ?? row.total_quantity ?? 0);
    if (!(qty > 0) && !row.outsource_work_order_code) return [];
    return [
      {
        id: order.id,
        material_code: pickString(row, 'material_code', 'product_code') ?? order.outsource_work_order_code,
        material_name:
          pickString(row, 'material_name', 'product_name') ??
          order.outsource_work_order_code ??
          '-',
        material_unit: pickString(row, 'unit', 'material_unit'),
        receipt_quantity: qty,
        qualified_quantity: Number(row.qualified_quantity ?? 0) || undefined,
        unqualified_quantity: Number(row.unqualified_quantity ?? 0) || undefined,
        warehouse_name: order.warehouse_name,
        location_code: pickString(row, 'location_name', 'location_code'),
        batch_number: pickString(row, 'batch_number'),
      },
    ];
  }

  return [];
}
