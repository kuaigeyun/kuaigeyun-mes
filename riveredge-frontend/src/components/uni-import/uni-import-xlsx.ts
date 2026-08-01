/**
 * 导入模板 xlsx 下载与解析。
 * 下载：ExcelJS（可写数据有效性下拉）；解析优先走 OOXML 原文（cfb），禁止 SheetJS 浮点截断。
 */

import { readXlsxWorksheetStringMatrix } from './xlsx-raw-cell-values';

/** 模板数据区行数（含示例行），与 UniSheet 预留量同量级，便于线下填表 */
const TEMPLATE_DATA_ROWS = 100;

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

/** 0-based 列号 → A1 列字母 */
export function colIndexToA1Letter(colIndex: number): string {
  let n = colIndex + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function triggerBrowserDownload(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * 生成并下载导入模板（表头 + 示例行 + 空行）。
 * 有 columnOptions 的列写入 Excel 列表数据有效性（选项落在隐藏工作表，避免逗号/长度限制）。
 */
export async function downloadImportTemplateXlsx(
  headers: string[],
  exampleRow: string[] | undefined,
  fileName: string,
  columnOptions?: Array<string[] | undefined | null>,
): Promise<void> {
  if (!headers.length) {
    throw new Error('缺少表头，无法生成模板');
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('导入数据');

  const headerLine = headers.map((h) => String(h ?? ''));
  sheet.addRow(headerLine);
  if (exampleRow?.length) {
    sheet.addRow(normalizeRow(exampleRow, headers.length));
  } else {
    sheet.addRow(Array(headers.length).fill(''));
  }
  for (let i = 0; i < TEMPLATE_DATA_ROWS - 1; i += 1) {
    sheet.addRow(Array(headers.length).fill(''));
  }

  headerLine.forEach((_, colIndex) => {
    const col = sheet.getColumn(colIndex + 1);
    col.width = Math.min(28, Math.max(12, String(headers[colIndex] ?? '').length + 2));
  });

  const listsSheet = workbook.addWorksheet('_lists');
  listsSheet.state = 'veryHidden';

  let hasListColumn = false;
  (columnOptions ?? []).forEach((opts, colIndex) => {
    if (colIndex >= headers.length || !opts?.length) return;
    const values = opts.map((v) => String(v ?? '').trim()).filter(Boolean);
    if (!values.length) return;

    hasListColumn = true;
    const listCol = colIndex + 1;
    values.forEach((value, rowIndex) => {
      listsSheet.getCell(rowIndex + 1, listCol).value = value;
    });

    const colLetter = colIndexToA1Letter(colIndex);
    const listColLetter = colIndexToA1Letter(colIndex);
    // 示例行起（Excel 第 2 行）到模板数据区末行
    const range = `${colLetter}2:${colLetter}${TEMPLATE_DATA_ROWS + 1}`;
    const formulae = [`_lists!$${listColLetter}$1:$${listColLetter}$${values.length}`];
    sheet.dataValidations.add(range, {
      type: 'list',
      allowBlank: true,
      showErrorMessage: false,
      showInputMessage: false,
      formulae,
    });
  });

  if (!hasListColumn) {
    workbook.removeWorksheet('_lists');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerBrowserDownload(buffer as ArrayBuffer, fileName);
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
