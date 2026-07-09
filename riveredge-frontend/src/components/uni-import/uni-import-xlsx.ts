/**
 * 导入模板 xlsx 下载与解析。
 * 解析优先走 OOXML 原文（cfb），禁止 SheetJS 浮点 / 显示格式截断精度。
 */

import { readXlsxWorksheetStringMatrix } from './xlsx-raw-cell-values';

function trimTrailingEmptyRows(rows: unknown[][]): unknown[][] {
  let end = rows.length;
  while (end > 0) {
    const row = rows[end - 1];
    const hasValue = row?.some((cell) => String(cell ?? '').trim() !== '');
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
  const rows: string[][] = [headers.map((h) => String(h ?? ''))];
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

function isZipXlsx(buffer: ArrayBuffer): boolean {
  const u8 = new Uint8Array(buffer);
  // PK\x03\x04
  return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04;
}

/** 解析用户上传的 xlsx/xls，返回二维字符串数组（保留全部小数位原文） */
export async function parseImportXlsxFile(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();

  // .xlsx：只信 OOXML 原文，绝不走 SheetJS 数值浮点
  if (isZipXlsx(buffer)) {
    const matrix = readXlsxWorksheetStringMatrix(buffer, 0);
    const trimmed = trimTrailingEmptyRows(matrix);
    if (trimmed.length === 0) {
      throw new Error('Excel 中没有有效数据');
    }
    const columnCount = Math.max(1, ...trimmed.map((r) => (Array.isArray(r) ? r.length : 0)));
    return trimmed.map((row) => normalizeRow(row, columnCount));
  }

  // 旧版 .xls：无 OOXML，只能用 SheetJS；数值用 toString（仍可能受 IEEE 限制）
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, cellText: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel 文件中没有工作表');
  }
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'];
  if (ref == null || String(ref).trim() === '') {
    throw new Error('Excel 中没有有效数据');
  }
  const range = XLSX.utils.decode_range(String(ref));
  const rows: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as { t?: string; v?: unknown; w?: string } | undefined;
      if (!cell) {
        row.push('');
        continue;
      }
      if (cell.t === 'n' && typeof cell.v === 'number') {
        row.push(cell.v.toString());
        continue;
      }
      if (cell.v != null && cell.v !== '') {
        row.push(String(cell.v).trim().replace(/,/g, ''));
        continue;
      }
      row.push(cell.w != null ? String(cell.w).trim().replace(/,/g, '') : '');
    }
    rows.push(row);
  }
  const trimmed = trimTrailingEmptyRows(rows);
  if (trimmed.length === 0) {
    throw new Error('Excel 中没有有效数据');
  }
  const columnCount = Math.max(1, ...trimmed.map((r) => (Array.isArray(r) ? r.length : 0)));
  return trimmed.map((row) => normalizeRow(row, columnCount));
}
