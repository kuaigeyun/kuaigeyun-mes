/** 与后端 fifo_policy 对齐的出库批号推荐排序 */

export type WarehouseFifoMode = 'batch_id' | 'production_date' | 'expiry_date';

export type FifoSortableBatch = {
  value: string;
  batchId?: number;
  productionDate?: string | null;
  expiryDate?: string | null;
};

const DATE_MIN = '0000-01-01';
const DATE_MAX = '9999-12-31';

export function normalizeFifoMode(raw: unknown): WarehouseFifoMode {
  const mode = String(raw ?? 'batch_id').trim().toLowerCase();
  if (mode === 'production_date' || mode === 'expiry_date') return mode;
  return 'batch_id';
}

function parseDay(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  // API 可能为 YYYY-MM-DD 或带时间墙钟
  return s.slice(0, 10);
}

/** 越小越应先出（与后端 batch_fifo_sort_key 一致） */
export function batchFifoSortKey(
  batch: FifoSortableBatch,
  fifoMode: WarehouseFifoMode,
): [number | boolean, string | number, number] | [number] {
  const bid = Number(batch.batchId) || 0;
  if (fifoMode === 'production_date') {
    const pd = parseDay(batch.productionDate);
    return [pd != null, pd ?? DATE_MIN, bid];
  }
  if (fifoMode === 'expiry_date') {
    const ed = parseDay(batch.expiryDate);
    return [ed == null, ed ?? DATE_MAX, bid];
  }
  return [bid];
}

export function compareBatchesForFifo(
  a: FifoSortableBatch,
  b: FifoSortableBatch,
  fifoMode: WarehouseFifoMode,
): number {
  const ka = batchFifoSortKey(a, fifoMode);
  const kb = batchFifoSortKey(b, fifoMode);
  const n = Math.max(ka.length, kb.length);
  for (let i = 0; i < n; i += 1) {
    const va = ka[i] as string | number | boolean | undefined;
    const vb = kb[i] as string | number | boolean | undefined;
    if (va === vb) continue;
    if (typeof va === 'boolean' && typeof vb === 'boolean') {
      return Number(va) - Number(vb);
    }
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va ?? '').localeCompare(String(vb ?? ''));
  }
  return String(a.value).localeCompare(String(b.value));
}

export function sortBatchesForFifo<T extends FifoSortableBatch>(
  batches: T[],
  fifoMode: WarehouseFifoMode,
): T[] {
  return [...batches].sort((a, b) => compareBatchesForFifo(a, b, fifoMode));
}
