/** 导入表头规范化：去首尾空白、去掉必填星号 */
export function normalizeImportHeader(name: unknown): string {
  return String(name ?? '')
    .trim()
    .replace(/^\*+/, '')
    .trim();
}

/** 系统列索引 → Excel 列索引；-1 表示不导入 */
export type ColumnMapping = number[];

export function resolveSystemFieldKey(
  systemHeader: string,
  fieldMap?: Record<string, string>,
): string {
  const raw = String(systemHeader ?? '').trim();
  const normalized = normalizeImportHeader(raw);
  return (
    fieldMap?.[raw] ||
    fieldMap?.[normalized] ||
    fieldMap?.[`*${normalized}`] ||
    normalized
  );
}

/** 根据表头名称与 fieldMap 自动匹配 Excel 列 */
export function autoMatchColumnMapping(
  systemHeaders: string[],
  excelHeaders: string[],
  fieldMap?: Record<string, string>,
): ColumnMapping {
  const usedExcel = new Set<number>();
  const mapping: ColumnMapping = systemHeaders.map(() => -1);

  systemHeaders.forEach((sysHeader, sysIdx) => {
    const sysNorm = normalizeImportHeader(sysHeader);
    const sysKey = resolveSystemFieldKey(sysHeader, fieldMap);

    for (let excelIdx = 0; excelIdx < excelHeaders.length; excelIdx++) {
      if (usedExcel.has(excelIdx)) continue;
      const rawExcel = String(excelHeaders[excelIdx] ?? '').trim();
      if (!rawExcel) continue;
      const exNorm = normalizeImportHeader(rawExcel);
      const exKey = resolveSystemFieldKey(rawExcel, fieldMap);

      const matched =
        sysNorm === exNorm ||
        sysKey === exKey ||
        sysNorm === exKey ||
        sysKey === exNorm ||
        rawExcel === sysHeader.trim();

      if (matched) {
        mapping[sysIdx] = excelIdx;
        usedExcel.add(excelIdx);
        break;
      }
    }
  });

  return mapping;
}

/** 从原始 Excel 行中读取表头行（headerRowIndex 为 1-based） */
export function extractExcelHeaders(
  rawRows: string[][],
  headerRowIndex: number,
): string[] {
  const rowIdx = Math.max(0, headerRowIndex - 1);
  const row = rawRows[rowIdx] ?? [];
  const colCount = Math.max(
    row.length,
    ...rawRows.map(r => (Array.isArray(r) ? r.length : 0)),
  );
  return Array.from({ length: colCount }, (_, i) => String(row[i] ?? '').trim());
}

/** 将用户 Excel 按映射转为系统约定二维表：第 1 行系统表头、第 2 行示例、其后为数据 */
export function buildMappedImportRows(options: {
  systemHeaders: string[];
  exampleRow?: string[];
  rawRows: string[][];
  headerRowIndex: number;
  columnMapping: ColumnMapping;
}): string[][] {
  const { systemHeaders, exampleRow, rawRows, headerRowIndex, columnMapping } = options;
  const dataStartIdx = Math.max(0, headerRowIndex);

  const result: string[][] = [systemHeaders.map(h => String(h ?? ''))];

  const example =
    exampleRow && exampleRow.length > 0
      ? exampleRow
      : systemHeaders.map(() => '');
  result.push(example.map(v => String(v ?? '')));

  for (let r = dataStartIdx; r < rawRows.length; r++) {
    const srcRow = rawRows[r] ?? [];
    const hasData = srcRow.some(c => String(c ?? '').trim() !== '');
    if (!hasData) continue;

    const outRow = systemHeaders.map((_, sysIdx) => {
      const excelIdx = columnMapping[sysIdx] ?? -1;
      if (excelIdx < 0) return '';
      return String(srcRow[excelIdx] ?? '').trim();
    });
    if (outRow.some(c => c !== '')) {
      result.push(outRow);
    }
  }

  return result;
}
