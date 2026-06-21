import { apiRequest } from '../../../../../services/api';
import { materialSerialApi } from '../../../../master-data/services/material';

export type InventoryPickOption = {
  value: string;
  label: string;
  quantity?: number;
  warehouseName?: string;
};

/** 与后端库存过账一致：空批号视为 DEFAULT */
export function normalizeOutboundBatchNo(raw: unknown): string {
  const bn = String(raw ?? '').trim();
  return bn || 'DEFAULT';
}

/** 确认出库批号：须为在库选项；仅一条时自动选中，禁止无依据默认 DEFAULT */
export function resolveOutboundConfirmBatchValue(
  saved: unknown,
  options: InventoryPickOption[],
): string | undefined {
  if (!options.length) return undefined;
  const raw = String(saved ?? '').trim();
  if (raw) {
    const normalized = normalizeOutboundBatchNo(raw);
    const hit = options.find((o) => o.value === raw || o.value === normalized);
    if (hit) return hit.value;
  }
  if (options.length === 1) return options[0].value;
  return undefined;
}

export function isValidOutboundBatchSelection(
  batch: unknown,
  options: InventoryPickOption[],
): boolean {
  const raw = String(batch ?? '').trim();
  if (!raw || !options.length) return false;
  const normalized = normalizeOutboundBatchNo(raw);
  return options.some((o) => o.value === raw || o.value === normalized);
}

function rowsToBatchOptionMap(
  rows: Record<string, unknown>[],
  labelFn?: (batch: string, qty: number, warehouseName?: string) => string,
): Record<number, InventoryPickOption[]> {
  const map: Record<number, InventoryPickOption[]> = {};
  for (const row of rows) {
    const mid = row.material_id as number;
    if (!mid) continue;
    const qty = Number(row.quantity ?? 0);
    if (qty <= 0) continue;
    if (row.status === '已过期' || row.status === '无库存') continue;
    const bn = normalizeOutboundBatchNo(row.batch_no);
    if (!map[mid]) map[mid] = [];
    if (map[mid].some((o) => o.value === bn)) continue;
    const warehouseName = String(row.warehouse_name ?? '').trim() || undefined;
    map[mid].push({
      value: bn,
      label: labelFn ? labelFn(bn, qty, warehouseName) : `${bn}（${qty}）`,
      quantity: qty,
      warehouseName,
    });
  }
  return map;
}

async function fetchBatchQueryRows(
  materialIds: number[],
  warehouseId?: number,
): Promise<Record<string, unknown>[]> {
  const res = await apiRequest<{ items?: Record<string, unknown>[] }>(
    '/apps/kuaizhizao/reports/inventory/batch-query',
    {
      method: 'GET',
      params: {
        material_ids: materialIds,
        include_expired: false,
        ...(warehouseId != null && warehouseId > 0 ? { warehouse_id: warehouseId } : {}),
      },
    },
  );
  return res.items ?? [];
}

export async function loadBatchOptionsByMaterialId(
  materialIds: number[],
  warehouseId?: number,
  labelFn?: (batch: string, qty: number, warehouseName?: string) => string,
): Promise<Record<number, InventoryPickOption[]>> {
  if (!materialIds.length) return {};

  const rows = await fetchBatchQueryRows(materialIds, warehouseId);
  let map = rowsToBatchOptionMap(rows, labelFn);

  const missingAfterWhFilter = materialIds.filter((mid) => !(map[mid]?.length));
  if (warehouseId != null && warehouseId > 0 && missingAfterWhFilter.length) {
    const fallbackRows = await fetchBatchQueryRows(missingAfterWhFilter);
    const fallbackMap = rowsToBatchOptionMap(fallbackRows, labelFn);
    for (const mid of missingAfterWhFilter) {
      if (fallbackMap[mid]?.length) {
        map[mid] = fallbackMap[mid];
      }
    }
  }

  return map;
}

/** 拉取物料全部在库序列号（分页合并，供出库确认多选） */
export async function loadInStockSerialOptions(materialUuid: string): Promise<InventoryPickOption[]> {
  const pageSize = 100;
  let page = 1;
  const serialNos: string[] = [];
  let total = 0;

  while (true) {
    const res = await materialSerialApi.list({
      materialUuid,
      status: 'in_stock',
      page,
      pageSize,
      sortBy: 'serial_no',
      sortOrder: 'asc',
    });
    total = res.total ?? 0;
    const items = res.items ?? [];
    for (const it of items) {
      const sn = String(it.serialNo ?? (it as { serial_no?: string }).serial_no ?? '').trim();
      if (sn && !serialNos.includes(sn)) serialNos.push(sn);
    }
    if (items.length < pageSize || serialNos.length >= total) break;
    page += 1;
  }

  return serialNos.map((sn) => ({ value: sn, label: sn }));
}
