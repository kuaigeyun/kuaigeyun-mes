import { workOrderApi, warehouseApi } from '../../../services/production';
import { shipmentNoticeApi } from '../../../services/shipment-notice';

export type InspectionDropdownOption = { label: string; value: number };

/** 列表 API 响应归一化为数组（兼容 data / items / 直出数组） */
export function unwrapApiList<T = Record<string, unknown>>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

function dedupeById<T extends { id?: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  return rows.filter((row) => {
    const id = row.id;
    if (id == null || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function listByStatuses<T extends { id?: number }>(
  fetcher: (params: Record<string, unknown>) => Promise<unknown>,
  statuses: string[],
  params: Record<string, unknown> = {},
  limit = 100,
): Promise<T[]> {
  const results = await Promise.all(
    statuses.map((status) => fetcher({ ...params, skip: 0, limit, status })),
  );
  return dedupeById(results.flatMap((response) => unwrapApiList<T>(response)));
}

function formatWorkOrderLabel(wo: Record<string, unknown>): string {
  const code = String(wo.code ?? '');
  const name = String(wo.name || wo.product_name || '').trim();
  return name ? `${code} - ${name}` : code;
}

/** 过程/成品检验：已下达 + 执行中（后端 status 为英文码，勿用「进行中」） */
export async function fetchWorkOrdersForInspection(
  params: Record<string, unknown> = {},
): Promise<InspectionDropdownOption[]> {
  const rows = await listByStatuses<Record<string, unknown>>(
    (p) => workOrderApi.list(p),
    ['released', 'in_progress'],
    params,
  );
  return rows.map((wo) => ({
    label: formatWorkOrderLabel(wo),
    value: wo.id as number,
  }));
}

/** 来料检验：待入库 + 已入库（与后端 create_inspection_from_purchase_receipt 一致） */
export async function fetchPurchaseReceiptsForIqc(
  params: Record<string, unknown> = {},
): Promise<InspectionDropdownOption[]> {
  const rows = await listByStatuses<Record<string, unknown>>(
    (p) => warehouseApi.purchaseReceipt.list(p),
    ['待入库', '已入库'],
    params,
  );
  return rows.map((receipt) => ({
    label: `${receipt.receipt_code ?? ''} - ${receipt.supplier_name ?? ''}`.replace(/ - $/, ''),
    value: receipt.id as number,
  }));
}

/** 出货检验：待发货 + 已通知（均可下推 OQC） */
export async function fetchShipmentNoticesForOqc(
  params: Record<string, unknown> = {},
): Promise<InspectionDropdownOption[]> {
  const rows = await listByStatuses<Record<string, unknown>>(
    (p) => shipmentNoticeApi.list(p),
    ['待发货', '已通知'],
    params,
  );
  return rows.map((notice) => ({
    label: `${notice.notice_code ?? ''} · ${notice.customer_name ?? ''}`.trim(),
    value: notice.id as number,
  }));
}

/** 出货检验：待出库销售出库单 */
export async function fetchSalesDeliveriesForOqc(
  params: Record<string, unknown> = {},
): Promise<InspectionDropdownOption[]> {
  const rows = await listByStatuses<Record<string, unknown>>(
    (p) => warehouseApi.salesDelivery.list(p),
    ['待出库'],
    params,
  );
  return rows.map((delivery) => ({
    label: `${delivery.delivery_code ?? ''} · ${delivery.customer_name ?? ''}`.trim(),
    value: delivery.id as number,
  }));
}
