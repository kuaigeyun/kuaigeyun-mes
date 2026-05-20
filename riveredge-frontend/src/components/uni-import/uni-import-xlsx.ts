/**
 * 导入模板 xlsx 下载与解析（懒加载 xlsx，与 vite vendor-xlsx 分包一致）
 */

function trimTrailingEmptyRows(rows: unknown[][]): unknown[][] {
  let end = rows.length;
  while (end > 0) {
    const row = rows[end - 1];
    const hasValue = row?.some(cell => String(cell ?? '').trim() !== '');
    if (hasValue) break;
    end -= 1;
  }
  return rows.slice(0, end);
}

function normalizeRow(row: unknown, columnCount: number): string[] {
  const arr = Array.isArray(row) ? row : [];
  return Array.from({ length: columnCount }, (_, i) => {
    const v = arr[i];
    return v === null || v === undefined ? '' : String(v);
  });
}

/** 生成并下载导入模板（表头 + 示例行 + 若干空行） */
export async function downloadImportTemplateXlsx(
  headers: string[],
  exampleRow: string[] | undefined,
  fileName: string,
): Promise<void> {
  if (!headers.length) {
    throw new Error('缺少表头，无法生成模板');
  }
  const XLSX = await import('xlsx');
  const rows: string[][] = [headers.map(h => String(h ?? ''))];
  if (exampleRow?.length) {
    rows.push(normalizeRow(exampleRow, headers.length));
  }
  for (let i = 0; i < 20; i++) {
    rows.push(Array(headers.length).fill(''));
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, '导入数据');
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

/** 解析用户上传的 xlsx/xls，返回二维数组（保留表头与示例行，供 onConfirm 按 slice(2) 约定处理） */
export async function parseImportXlsxFile(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel 文件中没有工作表');
  }
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  const trimmed = trimTrailingEmptyRows(raw);
  if (trimmed.length === 0) {
    throw new Error('Excel 中没有有效数据');
  }

  const columnCount = Math.max(1, ...trimmed.map(r => (Array.isArray(r) ? r.length : 0)));
  return trimmed.map(row => normalizeRow(row, columnCount));
}
