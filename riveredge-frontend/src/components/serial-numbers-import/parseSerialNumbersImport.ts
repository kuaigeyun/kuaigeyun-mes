/** 解析粘贴/文件中的序列号列表 */

const SERIAL_HEADER_ALIASES = new Set([
  '序列号',
  'serial',
  'serial_no',
  'serialno',
  'serial number',
  'sn',
  '序号',
]);

function isSerialHeader(cell: string): boolean {
  const key = cell.trim().toLowerCase();
  return SERIAL_HEADER_ALIASES.has(key) || SERIAL_HEADER_ALIASES.has(cell.trim());
}

/** 从粘贴文本解析：支持换行、逗号/分号/Tab/竖线分隔 */
export function parseSerialNumbersFromText(text: string): string[] {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const lines = normalized.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,;\t，；|]+/).map((s) => s.trim()).filter(Boolean);
    out.push(...parts);
  }
  return dedupeSerialNumbers(out);
}

/** 去重并去掉空值，保留首次出现顺序 */
export function dedupeSerialNumbers(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = String(raw ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** 从 Excel/CSV 二维数组解析：默认取第一列；首行若为表头则跳过 */
export function parseSerialNumbersFromSheetRows(rows: string[][]): string[] {
  if (!rows.length) return [];
  let start = 0;
  const firstCell = String(rows[0]?.[0] ?? '').trim();
  if (firstCell && isSerialHeader(firstCell)) start = 1;
  const out: string[] = [];
  for (let i = start; i < rows.length; i++) {
    const cell = String(rows[i]?.[0] ?? '').trim();
    if (cell) out.push(cell);
  }
  return dedupeSerialNumbers(out);
}

/** 合并序列号：append 追加去重，replace 覆盖 */
export function mergeSerialNumbers(
  existing: string[] | undefined,
  incoming: string[],
  mode: 'append' | 'replace',
): string[] {
  if (mode === 'replace') return dedupeSerialNumbers(incoming);
  return dedupeSerialNumbers([...(existing ?? []), ...incoming]);
}

export function validateSerialNumbersCount(
  serials: string[],
  expectedCount?: number,
): { ok: boolean; message?: string } {
  if (expectedCount == null || !(expectedCount > 0)) return { ok: true };
  if (serials.length === expectedCount) return { ok: true };
  if (serials.length > expectedCount) {
    return { ok: false, message: `序列号 ${serials.length} 个，超过明细数量 ${expectedCount}` };
  }
  return { ok: false, message: `序列号 ${serials.length} 个，少于明细数量 ${expectedCount}` };
}
