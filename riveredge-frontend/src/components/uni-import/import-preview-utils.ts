/** 从完整导入二维表中取出数据行（默认跳过表头 + 示例行） */
export function getImportDataRows(data: any[][], dataStartRow = 2): any[][] {
  return data.slice(dataStartRow).filter(row =>
    row?.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''),
  );
}

/** 去掉尾部全空列，便于预览展示 */
export function trimImportTableColumns(
  headers: any[],
  rows: any[][],
): { headers: string[]; rows: string[][] } {
  const headerCells = headers.map(h => String(h ?? ''));
  let maxCol = Math.max(
    headerCells.length - 1,
    ...rows.map(r => (Array.isArray(r) ? r.length - 1 : -1)),
  );
  while (maxCol >= 0) {
    const headerEmpty = !headerCells[maxCol]?.trim();
    const colEmpty = rows.every(r => !String(r?.[maxCol] ?? '').trim());
    if (!headerEmpty || !colEmpty) break;
    maxCol -= 1;
  }
  const count = Math.max(0, maxCol + 1);
  return {
    headers: headerCells.slice(0, count),
    rows: rows.map(r =>
      Array.from({ length: count }, (_, i) =>
        r?.[i] === null || r?.[i] === undefined ? '' : String(r[i]),
      ),
    ),
  };
}

export function buildImportPreviewTableSource(options: {
  data: any[][];
  dataStartRow?: number;
  maxPreviewRows?: number;
}): {
  headers: string[];
  previewRows: string[][];
  totalDataRows: number;
  previewCount: number;
} {
  const { data, dataStartRow = 2, maxPreviewRows = 10 } = options;
  const headerRow = data[0] ?? [];
  const dataRows = getImportDataRows(data, dataStartRow);
  const { headers, rows } = trimImportTableColumns(headerRow, dataRows);
  const previewRows = rows.slice(0, maxPreviewRows);
  return {
    headers,
    previewRows,
    totalDataRows: rows.length,
    previewCount: previewRows.length,
  };
}
