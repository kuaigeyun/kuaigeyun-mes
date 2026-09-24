/**
 * 从 UniImport 当前 Univer 工作表读取字符串矩阵（含手工改格 / 下拉选择）。
 * 确认导入 / 预检必须以在线表为准，不能只读上传 Excel 时的缓存矩阵。
 *
 * 严禁按 getMaxRows 全表 scrape（默认上千行 × 多列会卡住主线程，表现为「预检并继续无反应」）。
 */

import { spreadsheetCellToPlainString } from '../../utils/spreadsheetCellPlainString';

type RangeLike = {
  getDisplayValues?: () => string[][] | null;
  getValues?: () => unknown[][] | null;
  getCellDatas?: () => unknown[][] | null;
};

type SheetLike = {
  getMaxRows?: () => number;
  getMaxColumns?: () => number;
  getLastRow?: () => number;
  getLastColumn?: () => number;
  getDataRange?: () => RangeLike | null;
  getCellValue?: (row: number, col: number) => unknown;
  getRange?: (
    row: number,
    col: number,
    numRows: number,
    numCols: number,
  ) => RangeLike | null;
};

type WorkbookLike = {
  getSheetBySheetId?: (id: string) => SheetLike | null;
  getActiveSheet?: () => SheetLike | null;
};

type UniverApiLike = {
  getActiveWorkbook?: () => WorkbookLike | null;
};

const NUMERIC_PLAIN_RE = /^\d+(\.\d+)?([eE][+-]?\d+)?$/;
/** 硬上限：防止误读全表把页面卡死 */
const HARD_MAX_ROWS = 20_000;
const HARD_MAX_COLS = 200;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const obj = value as { v?: unknown; m?: unknown };
    const display = typeof obj.m === 'string' ? obj.m.trim() : '';
    if (display && typeof obj.v === 'number' && !NUMERIC_PLAIN_RE.test(display)) {
      return display.replace(/,/g, '');
    }
  }
  return spreadsheetCellToPlainString(value);
}

function rowHasContent(row: string[]): boolean {
  return row.some((cell) => String(cell ?? '').trim() !== '');
}

function bulkToMatrix(bulk: unknown[][]): string[][] {
  return bulk.map((src) => {
    const row = Array.isArray(src) ? src : [];
    return row.map((cell) => cellToString(cell));
  });
}

function trimMatrix(
  matrix: string[][],
  minColumnCount: number,
): string[][] {
  let lastContentRow = 1;
  for (let r = matrix.length - 1; r >= 0; r -= 1) {
    if (rowHasContent(matrix[r])) {
      lastContentRow = r;
      break;
    }
  }
  const kept = matrix.slice(0, Math.max(2, lastContentRow + 1));

  const headerWidth = kept[0]?.length ?? 0;
  let maxUsedCol = Math.max(minColumnCount, headerWidth) - 1;
  for (const row of kept) {
    for (let c = row.length - 1; c >= 0; c -= 1) {
      if (String(row[c] ?? '').trim() !== '') {
        if (c > maxUsedCol) maxUsedCol = c;
        break;
      }
    }
  }
  const finalCols = Math.max(minColumnCount, maxUsedCol + 1);
  return kept.map((row) => {
    const next = row.slice(0, finalCols);
    while (next.length < finalCols) next.push('');
    return next;
  });
}

/**
 * 在线表与上传/粘贴缓存合并：
 * - 手工改格 / 下拉 → 以在线表为准
 * - 数值显示被引擎截断时 → 保留缓存中更完整的原文
 */
export function mergeLiveImportRowsWithPrecisionCache(
  liveRows: string[][],
  cachedRows: string[][] | null | undefined,
): string[][] {
  if (!cachedRows || cachedRows.length === 0) return liveRows;

  const rowCount = Math.max(liveRows.length, cachedRows.length);
  const merged: string[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const liveRow = liveRows[r] ?? [];
    const cachedRow = cachedRows[r] ?? [];
    const colCount = Math.max(liveRow.length, cachedRow.length);
    const row: string[] = [];
    for (let c = 0; c < colCount; c += 1) {
      const liveTrim = String(liveRow[c] ?? '').trim();
      const cachedTrim = String(cachedRow[c] ?? '').trim();
      if (liveTrim === cachedTrim) {
        row.push(cachedTrim || liveTrim);
        continue;
      }
      if (
        liveTrim &&
        cachedTrim &&
        NUMERIC_PLAIN_RE.test(liveTrim) &&
        NUMERIC_PLAIN_RE.test(cachedTrim)
      ) {
        const liveNum = Number(liveTrim);
        const cachedNum = Number(cachedTrim);
        if (
          Number.isFinite(liveNum) &&
          Number.isFinite(cachedNum) &&
          liveNum === cachedNum &&
          cachedTrim.replace(/[.,]/g, '').length > liveTrim.replace(/[.,]/g, '').length
        ) {
          row.push(cachedTrim);
          continue;
        }
      }
      // 在线行未覆盖到的列：保留缓存；覆盖到的列（含清空）以在线为准
      if (c >= liveRow.length) {
        row.push(cachedTrim);
      } else {
        row.push(liveTrim);
      }
    }
    merged.push(row);
  }
  return merged;
}

export type ReadImportSheetOptions = {
  minColumnCount?: number;
  /** 上传/粘贴行数提示：限制 scrape 上界，避免扫全表卡死 */
  hintRowCount?: number;
  hintColumnCount?: number;
};

/**
 * 读取当前 sheet 的字符串矩阵；失败返回 null（调用方回落缓存）。
 */
export function readImportSheetStringMatrix(
  univerAPI: unknown,
  options?: ReadImportSheetOptions,
): string[][] | null {
  const api = univerAPI as UniverApiLike | null | undefined;
  if (!api?.getActiveWorkbook) return null;

  let workbook: WorkbookLike | null = null;
  try {
    workbook = api.getActiveWorkbook() ?? null;
  } catch {
    return null;
  }
  if (!workbook) return null;

  const sheet =
    workbook.getSheetBySheetId?.('sheet-1') ?? workbook.getActiveSheet?.() ?? null;
  if (!sheet) return null;

  const minCols = Math.max(0, options?.minColumnCount ?? 0);
  const hintRows = Math.max(0, options?.hintRowCount ?? 0);
  const hintCols = Math.max(minCols, options?.hintColumnCount ?? 0);

  // 上界：提示行数 + 余量，且不超过硬顶；禁止用 getMaxRows 当读取窗口
  const maxReadRows = Math.min(
    HARD_MAX_ROWS,
    Math.max(hintRows > 0 ? hintRows + 50 : 2_000, 2),
  );
  const maxReadCols = Math.min(HARD_MAX_COLS, Math.max(hintCols > 0 ? hintCols + 5 : 64, minCols, 1));

  let matrix: string[][] | null = null;

  // 1) 仅读「有内容」数据区显示值（与公式栏 / 下拉所见一致）
  try {
    const dataRange = sheet.getDataRange?.();
    const display = dataRange?.getDisplayValues?.();
    if (Array.isArray(display) && display.length > 0) {
      const capped = display.slice(0, maxReadRows).map((row) => {
        const cells = Array.isArray(row) ? row : [];
        return cells.slice(0, maxReadCols);
      });
      matrix = bulkToMatrix(capped);
    }
  } catch {
    matrix = null;
  }

  // 2) 回退：按提示窗口 scrape（仍受硬顶约束）
  if (!matrix) {
    try {
      const rowCount = Math.max(2, Math.min(maxReadRows, hintRows > 0 ? hintRows : maxReadRows));
      const colCount = Math.max(1, Math.min(maxReadCols, hintCols > 0 ? hintCols : maxReadCols));
      const range = sheet.getRange?.(0, 0, rowCount, colCount);
      const bulk =
        range?.getDisplayValues?.() ??
        range?.getCellDatas?.() ??
        range?.getValues?.() ??
        null;
      if (Array.isArray(bulk) && bulk.length > 0) {
        matrix = bulkToMatrix(bulk);
      }
    } catch {
      matrix = null;
    }
  }

  if (!matrix || matrix.length === 0) return null;
  return trimMatrix(matrix, minCols);
}
