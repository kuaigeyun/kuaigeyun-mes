/**
 * 表格单元格 → 纯文本。
 * 字符串原样保留；数值仅在无字符串原文时用 toString（禁止 toPrecision / 格式化 w）。
 */

export function spreadsheetNumberToPlainString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return value.trim().replace(/,/g, '');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const direct = value.toString();
    if (!direct.includes('e') && !direct.includes('E')) {
      return direct;
    }
    return value.toFixed(20).replace(/\.?0+$/, '') || '0';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return String(value).trim().replace(/,/g, '');
}

/** 解析 Univer / xlsx 单元格对象：字符串 v 优先于数值 */
export function spreadsheetCellToPlainString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    const obj = cell as { v?: unknown; m?: unknown; value?: unknown; t?: unknown };
    // FORCE_STRING / 文本：v 为字符串时原样返回，禁止再 Number()
    if (typeof obj.v === 'string') {
      return obj.v.trim().replace(/,/g, '');
    }
    if (obj.v !== undefined && obj.v !== null && obj.v !== '') {
      return spreadsheetNumberToPlainString(obj.v);
    }
    if (typeof obj.m === 'string' && obj.m.trim() !== '') {
      return obj.m.trim().replace(/,/g, '');
    }
    if (obj.value !== undefined && obj.value !== null && obj.value !== '') {
      return spreadsheetNumberToPlainString(obj.value);
    }
    if (obj.m !== undefined && obj.m !== null && obj.m !== '') {
      return spreadsheetNumberToPlainString(obj.m);
    }
    return '';
  }
  return spreadsheetNumberToPlainString(cell);
}

/** xlsx SheetJS 单元格：数值型只用 v，不用 w */
export function xlsxCellToPlainString(cell: { t?: string; v?: unknown; w?: string } | undefined): string {
  if (!cell) return '';
  if (cell.t === 'n') {
    return spreadsheetNumberToPlainString(cell.v);
  }
  if (cell.v !== null && cell.v !== undefined && cell.v !== '') {
    return spreadsheetNumberToPlainString(cell.v);
  }
  if (cell.w != null && String(cell.w).trim() !== '') {
    return String(cell.w).trim().replace(/,/g, '');
  }
  return '';
}

/** 兼容旧调用：XML 原文优先 */
export function resolveXlsxNumericPlainString(
  cell: { t?: string; v?: unknown; w?: string } | undefined,
  rawXmlValue?: string | null,
): string {
  if (rawXmlValue != null && String(rawXmlValue).trim() !== '') {
    return String(rawXmlValue).trim().replace(/,/g, '');
  }
  return xlsxCellToPlainString(cell);
}
