/**
 * Excel → Univer 粘贴：优先从 text/html 的 x:num / ss:Type=Number 取完整数值原文，
 * text/plain 常为显示截断值，不能单独依赖。
 */

/** Univer CellValueType.FORCE_STRING */
export const CELL_FORCE_STRING = 4;

const NUMERIC_RE = /^\d+(\.\d+)?([eE][+-]?\d+)?$/;

function fractionalDigits(value: string): number {
  const cleaned = value.trim().replace(/,/g, '');
  const dot = cleaned.indexOf('.');
  if (dot < 0) return 0;
  return cleaned.length - dot - 1;
}

function pickRicherText(a: string, b: string): string {
  const na = a.trim().replace(/,/g, '');
  const nb = b.trim().replace(/,/g, '');
  const aNum = NUMERIC_RE.test(na);
  const bNum = NUMERIC_RE.test(nb);
  if (aNum && bNum) {
    const fa = fractionalDigits(na);
    const fb = fractionalDigits(nb);
    if (fb > fa) return nb;
    if (fa > fb) return na;
    return nb.length > na.length ? nb : na;
  }
  if (bNum && !aNum) return nb;
  if (a.trim() !== '') return a.trim().replace(/,/g, '');
  return b.trim().replace(/,/g, '');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function cellInnerText(tdHtml: string): string {
  const withoutTags = tdHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withoutTags).replace(/\u00a0/g, ' ').trim();
}

/**
 * 解析 Excel HTML 剪贴板。
 * 数值优先 x:num / ss:Type="Number" 属性中的完整原文。
 */
export function parseClipboardHtmlTable(html: string): string[][] | null {
  if (!html || !/<table[\s>]/i.test(html)) return null;

  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    const tdRe = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(rowHtml)) !== null) {
      const attrs = tdMatch[1];
      const inner = tdMatch[2];
      const display = cellInnerText(inner);

      const xNum =
        /\bx:num\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ??
        /\bx:num\s*=\s*'([^']*)'/i.exec(attrs)?.[1] ??
        null;
      // <td x:num>value</td> 无属性值时，完整值在单元格文本里
      const hasBareXNum = /\bx:num\b/i.test(attrs) && xNum == null;

      const ssType = /\bss:Type\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
      const ssNum =
        /\bss:Value\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ??
        (ssType.toLowerCase() === 'number' ? display : null);

      let value = display;
      if (xNum != null && String(xNum).trim() !== '') {
        value = pickRicherText(display, String(xNum));
      } else if (hasBareXNum) {
        value = display;
      } else if (ssNum != null && String(ssNum).trim() !== '') {
        value = pickRicherText(display, String(ssNum));
      }

      cells.push(value.replace(/,/g, ''));
    }
    if (cells.length) rows.push(cells);
  }
  return rows.length ? rows : null;
}

/** 解析 Excel/表格剪贴板（TSV） */
export function parseClipboardTsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized) return [];
  const lines = normalized.replace(/\n+$/, '').split('\n');
  return lines.map((line) => line.split('\t').map((cell) => cell.replace(/,/g, '')));
}

/** HTML 与 plain 逐格取小数位更长者 */
export function mergeHtmlAndPlainMatrices(
  htmlRows: string[][] | null,
  plainRows: string[][],
): string[][] {
  if (!htmlRows?.length) return plainRows;
  if (!plainRows.length) return htmlRows;

  const rowCount = Math.max(htmlRows.length, plainRows.length);
  const result: string[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const hr = htmlRows[r] ?? [];
    const pr = plainRows[r] ?? [];
    const colCount = Math.max(hr.length, pr.length);
    const row: string[] = [];
    for (let c = 0; c < colCount; c += 1) {
      row.push(pickRicherText(pr[c] ?? '', hr[c] ?? ''));
    }
    result.push(row);
  }
  return result;
}

function isEmptyClipboardCell(value: string | undefined | null): boolean {
  return String(value ?? '').trim() === '';
}

/**
 * Excel/WPS 剪贴板常在有效内容右侧/下方带空白格；写入前裁掉，
 * 否则 setValues 会用空串清掉已有列/行。
 */
export function trimTrailingEmptyClipboardMatrix(rows: string[][]): string[][] {
  if (!rows.length) return rows;

  let endRow = rows.length - 1;
  while (endRow >= 0 && (rows[endRow] ?? []).every((c) => isEmptyClipboardCell(c))) {
    endRow -= 1;
  }
  if (endRow < 0) return [];

  let endCol = -1;
  for (let r = 0; r <= endRow; r += 1) {
    const row = rows[r] ?? [];
    for (let c = row.length - 1; c >= 0; c -= 1) {
      if (!isEmptyClipboardCell(row[c])) {
        endCol = Math.max(endCol, c);
        break;
      }
    }
  }
  if (endCol < 0) return [];

  return rows.slice(0, endRow + 1).map((row) =>
    Array.from({ length: endCol + 1 }, (_, c) => String(row[c] ?? '')),
  );
}

export function parseClipboardToStringMatrix(options: {
  html?: string | null;
  plain?: string | null;
}): string[][] {
  const plainRows = options.plain ? parseClipboardTsv(options.plain) : [];
  const htmlRows = options.html ? parseClipboardHtmlTable(options.html) : null;
  return trimTrailingEmptyClipboardMatrix(mergeHtmlAndPlainMatrices(htmlRows, plainRows));
}

export function buildForceStringCellMatrix(
  rows: string[][],
): Array<Array<{ v: string; m: string; t: number }>> {
  return rows.map((row) =>
    row.map((cell) => {
      const text = cell ?? '';
      return { v: text, m: text, t: CELL_FORCE_STRING };
    }),
  );
}

type UniverRangeLike = {
  getRange?: () => { startRow: number; startColumn: number; endRow: number; endColumn: number };
  getRangeData?: () => { startRow: number; startColumn: number; endRow: number; endColumn: number };
  setValues?: (value: unknown) => unknown;
};

type UniverSheetLike = {
  getActiveRange?: () => UniverRangeLike | null;
  getSelection?: () => { getActiveRange?: () => UniverRangeLike | null } | null;
  getRange?: (row: number, col: number, numRows: number, colCount: number) => UniverRangeLike | null;
  /** Univer facade 真源 */
  getMaxRows?: () => number;
  getMaxColumns?: () => number;
  /** 旧命名兼容（当前 facade 无此方法） */
  getRowCount?: () => number;
  getColumnCount?: () => number;
  setRowCount?: (rowCount: number) => unknown;
  setColumnCount?: (columnCount: number) => unknown;
};

type UniverApiLike = {
  getActiveWorkbook?: () => {
    getActiveSheet?: () => UniverSheetLike | null;
  } | null;
  onBeforeCommandExecute?: (callback: (command: { id?: string }) => void) => { dispose?: () => void };
};

export function resolveActiveStart(sheet: UniverSheetLike): {
  startRow: number;
  startColumn: number;
} {
  const active =
    sheet.getActiveRange?.() ?? sheet.getSelection?.()?.getActiveRange?.() ?? null;
  const data = active?.getRangeData?.() ?? active?.getRange?.();
  if (data && typeof data.startRow === 'number' && typeof data.startColumn === 'number') {
    return { startRow: data.startRow, startColumn: data.startColumn };
  }
  return { startRow: 0, startColumn: 0 };
}

function readSheetMaxRows(sheet: UniverSheetLike): number {
  return Number(sheet.getMaxRows?.() ?? sheet.getRowCount?.() ?? 0) || 0;
}

function readSheetMaxColumns(sheet: UniverSheetLike): number {
  return Number(sheet.getMaxColumns?.() ?? sheet.getColumnCount?.() ?? 0) || 0;
}

/**
 * 粘贴前按需扩容。必须读 getMaxRows/getMaxColumns；
 * 读不到当前尺寸时禁止 set*Count（否则会从 0「扩」成粘贴块，等于把右侧列/下方行裁掉）。
 */
export function ensureSheetCapacity(
  sheet: UniverSheetLike,
  requiredRows: number,
  requiredCols: number,
): void {
  const rows = Math.max(1, Math.ceil(requiredRows));
  const cols = Math.max(1, Math.ceil(requiredCols));
  const currentRows = readSheetMaxRows(sheet);
  const currentCols = readSheetMaxColumns(sheet);
  if (currentRows > 0 && rows > currentRows && typeof sheet.setRowCount === 'function') {
    sheet.setRowCount(rows);
  }
  if (currentCols > 0 && cols > currentCols && typeof sheet.setColumnCount === 'function') {
    sheet.setColumnCount(cols);
  }
}

export function mergePasteIntoStringMatrix(
  base: string[][] | null | undefined,
  pasteRows: string[][],
  startRow: number,
  startColumn: number,
): string[][] {
  const pasteColCount = Math.max(1, ...pasteRows.map((r) => r.length));
  const baseRows = (base ?? []).map((row) => row.map((c) => String(c ?? '')));
  const endRow = startRow + pasteRows.length - 1;
  const endCol = startColumn + pasteColCount - 1;
  const rowCount = Math.max(baseRows.length, endRow + 1);
  const colCount = Math.max(endCol + 1, ...baseRows.map((r) => r.length), 1);

  const next: string[][] = Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) => baseRows[r]?.[c] ?? ''),
  );

  for (let r = 0; r < pasteRows.length; r += 1) {
    for (let c = 0; c < pasteColCount; c += 1) {
      next[startRow + r][startColumn + c] = pasteRows[r]?.[c] ?? '';
    }
  }
  return next;
}

/** Univer 粘贴相关命令 id（拦截后改走我们的精度粘贴） */
export const UNIVER_PASTE_COMMAND_IDS = new Set([
  'univer.command.paste',
  'sheet.command.paste',
  'sheet.command.paste-by-short-key',
  'sheet.command.paste-value',
  'sheet.command.paste-format',
  'sheet.command.paste-col-width',
  'sheet.command.paste-besides-border',
  'sheet.command.optional-paste',
]);

/**
 * 将剪贴板（html+plain）以强制字符串写入当前选区起点。
 */
export function pasteClipboardAsForceString(
  univerAPI: UniverApiLike,
  clipboard: { html?: string | null; plain?: string | null },
  existingRows?: string[][] | null,
): string[][] | null {
  const pasteRows = parseClipboardToStringMatrix(clipboard);
  if (!pasteRows.length) return null;

  const sheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
  if (!sheet) return null;

  const { startRow, startColumn } = resolveActiveStart(sheet);
  const merged = mergePasteIntoStringMatrix(existingRows, pasteRows, startRow, startColumn);

  const pasteColCount = Math.max(1, ...pasteRows.map((r) => r.length));
  // 工作表默认仅 100 行；先扩容再写入，否则超出部分预览不可见
  ensureSheetCapacity(sheet, startRow + pasteRows.length, startColumn + pasteColCount);

  const padded = pasteRows.map((row) =>
    Array.from({ length: pasteColCount }, (_, i) => row[i] ?? ''),
  );
  const matrix = buildForceStringCellMatrix(padded);

  const target = sheet.getRange?.(startRow, startColumn, pasteRows.length, pasteColCount);
  if (!target?.setValues) {
    return null;
  }
  target.setValues(matrix);
  return merged;
}

/** @deprecated 使用 pasteClipboardAsForceString */
export function pasteClipboardTextAsForceString(
  univerAPI: UniverApiLike,
  clipboardText: string,
  existingRows?: string[][] | null,
): string[][] | null {
  return pasteClipboardAsForceString(univerAPI, { plain: clipboardText }, existingRows);
}
