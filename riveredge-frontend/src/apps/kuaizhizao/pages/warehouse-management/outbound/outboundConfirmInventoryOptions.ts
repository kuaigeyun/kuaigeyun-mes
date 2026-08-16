import { apiRequest } from '../../../../../services/api';
import { getBusinessConfig } from '../../../../../services/businessConfig';
import { materialSerialApi } from '../../../../master-data/services/material';
import {
  normalizeFifoMode,
  sortBatchesForFifo,
  type WarehouseFifoMode,
} from './outboundFifoSort';

export type InventoryPickOption = {
  value: string;
  label: string;
  quantity?: number;
  warehouseName?: string;
  /** MaterialBatch.id（主仓）；用于 FIFO 建档序 */
  batchId?: number;
  productionDate?: string | null;
  expiryDate?: string | null;
  /** 当前策略下建议优先出库 */
  fifoRecommended?: boolean;
};

/** 与后端库存过账一致：空批号视为 DEFAULT */
export function normalizeOutboundBatchNo(raw: unknown): string {
  const bn = String(raw ?? '').trim();
  return bn || 'DEFAULT';
}

function resolveMainBatchId(row: Record<string, unknown>): number | undefined {
  const rawId = Number(row.id ?? 0);
  // report_service 主仓行：id = 1000000 + MaterialBatch.id；线边 >= 2_000_000
  if (rawId >= 1_000_000 && rawId < 2_000_000) return rawId - 1_000_000;
  const explicit = Number(row.batch_id ?? row.material_batch_id ?? 0);
  return explicit > 0 ? explicit : undefined;
}

function earlierDay(a?: string | null, b?: string | null): string | null | undefined {
  const da = String(a ?? '').trim().slice(0, 10);
  const db = String(b ?? '').trim().slice(0, 10);
  if (!da) return db || a;
  if (!db) return da || b;
  return da <= db ? da : db;
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

function isOutboundDeductibleInventoryRow(row: Record<string, unknown>): boolean {
  const qty = Number(row.quantity ?? 0);
  if (!(qty > 0)) return false;
  const status = String(row.status ?? '').trim();
  // 与 InventoryService 默认扣减口径一致：仅自购(company_owned)+在库；客供不计入可出库库存
  const ownership = String(row.ownership_type ?? 'company_owned').trim() || 'company_owned';
  const customerId = Number(row.customer_id ?? 0) || 0;
  if (ownership !== 'company_owned' || customerId !== 0) return false;
  if (status === '已过期' || status === '无库存' || status === 'out_stock' || status === '已出库') {
    return false;
  }
  const rowId = Number(row.id ?? 0);
  if (rowId >= 2_000_000) return false; // 线边仓不计入主仓出库预览
  return status === 'in_stock' || status === '在库' || status === '';
}

function rowsToBatchOptionMap(
  rows: Record<string, unknown>[],
  labelFn?: (batch: string, qty: number, warehouseName?: string) => string,
  fifoMode: WarehouseFifoMode = 'batch_id',
): Record<number, InventoryPickOption[]> {
  const map: Record<number, InventoryPickOption[]> = {};
  for (const row of rows) {
    if (!isOutboundDeductibleInventoryRow(row)) continue;
    const mid = row.material_id as number;
    if (!mid) continue;
    const qty = Number(row.quantity ?? 0);
    const bn = normalizeOutboundBatchNo(row.batch_no);
    if (!map[mid]) map[mid] = [];
    const existing = map[mid].find((o) => o.value === bn);
    const warehouseName = String(row.warehouse_name ?? '').trim() || undefined;
    const batchId = resolveMainBatchId(row);
    const productionDate = (row.production_date as string | null | undefined) ?? null;
    const expiryDate = (row.expiry_date as string | null | undefined) ?? null;
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + qty;
      existing.label = labelFn
        ? labelFn(bn, existing.quantity, warehouseName ?? existing.warehouseName)
        : `${bn}（${existing.quantity}）`;
      if (batchId != null) {
        existing.batchId =
          existing.batchId == null ? batchId : Math.min(existing.batchId, batchId);
      }
      existing.productionDate = earlierDay(existing.productionDate, productionDate) ?? null;
      existing.expiryDate = earlierDay(existing.expiryDate, expiryDate) ?? null;
      continue;
    }
    map[mid].push({
      value: bn,
      label: labelFn ? labelFn(bn, qty, warehouseName) : `${bn}（${qty}）`,
      quantity: qty,
      warehouseName,
      batchId,
      productionDate,
      expiryDate,
    });
  }
  for (const mid of Object.keys(map)) {
    const sorted = sortBatchesForFifo(map[Number(mid)], fifoMode);
    sorted.forEach((opt, idx) => {
      opt.fifoRecommended = idx === 0;
    });
    map[Number(mid)] = sorted;
  }
  return map;
}

function sumDeductibleQtyByMaterialId(rows: Record<string, unknown>[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const row of rows) {
    if (!isOutboundDeductibleInventoryRow(row)) continue;
    const mid = Number(row.material_id);
    if (!Number.isFinite(mid) || mid <= 0) continue;
    out[mid] = (out[mid] ?? 0) + (Number(row.quantity) || 0);
  }
  return out;
}

async function fetchBatchQueryRows(
  materialIds: number[],
  warehouseId?: number,
  options?: { companyOwnedOnly?: boolean },
): Promise<Record<string, unknown>[]> {
  const companyOwnedOnly = options?.companyOwnedOnly === true;
  const res = await apiRequest<{ items?: Record<string, unknown>[] }>(
    '/apps/kuaizhizao/reports/inventory/batch-query',
    {
      method: 'GET',
      params: {
        material_ids: materialIds,
        include_expired: false,
        ...(warehouseId != null && warehouseId > 0 ? { warehouse_id: warehouseId } : {}),
        // 与 InventoryService 默认扣减一致：仅自购库存
        ...(companyOwnedOnly
          ? { ownership_type: 'company_owned', customer_id: 0 }
          : {}),
      },
    },
  );
  return res.items ?? [];
}

async function resolveWarehouseFifoMode(): Promise<WarehouseFifoMode> {
  try {
    const cfg = await getBusinessConfig();
    return normalizeFifoMode(cfg?.parameters?.warehouse?.fifo_mode);
  } catch {
    return 'batch_id';
  }
}

export async function loadBatchOptionsByMaterialId(
  materialIds: number[],
  warehouseId?: number,
  labelFn?: (batch: string, qty: number, warehouseName?: string) => string,
): Promise<Record<number, InventoryPickOption[]>> {
  if (!materialIds.length) return {};

  const [rows, fifoMode] = await Promise.all([
    fetchBatchQueryRows(materialIds, warehouseId, { companyOwnedOnly: true }),
    resolveWarehouseFifoMode(),
  ]);
  return rowsToBatchOptionMap(rows, labelFn, fifoMode);
}

/** 出库预览：汇总物料在库可用数量（各批号 quantity 之和） */
export function sumInventoryPickOptionQty(options: InventoryPickOption[] | undefined): number {
  if (!options?.length) return 0;
  return options.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
}

/**
 * 出库预览库存数量：与确认过账扣减口径一致（自购 company_owned + 在库）。
 * 客供库存不计入，避免出现 101（自购1+客供100）vs 过账可用1 的偏差。
 */
export async function loadAvailableQtyByMaterialId(
  materialIds: number[],
  warehouseId?: number,
): Promise<Record<number, number>> {
  if (!materialIds.length) return {};
  const rows = await fetchBatchQueryRows(materialIds, warehouseId, { companyOwnedOnly: true });
  const out = sumDeductibleQtyByMaterialId(rows);
  for (const mid of materialIds) {
    if (out[mid] == null) out[mid] = 0;
  }
  return out;
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
