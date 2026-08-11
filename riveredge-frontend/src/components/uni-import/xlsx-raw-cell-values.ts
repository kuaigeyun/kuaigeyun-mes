/**
 * 从 xlsx（OOXML）直接读单元格原文，不经过 SheetJS / JS number / Univer。
 * 数值用 <v> 原文；共享字符串 / 内联字符串原样保留。
 */
import * as CFB from 'cfb';

function readCfbEntryText(cfb: CFB.CFB$Container, path: string): string | null {
  const candidates = [path, path.startsWith('/') ? path.slice(1) : `/${path}`];
  for (const candidate of candidates) {
    const entry = CFB.find(cfb, candidate);
    if (entry?.content) {
      return new TextDecoder('utf-8').decode(entry.content as Uint8Array);
    }
  }
  return null;
}

function codePointToChar(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/** OOXML 合法：中文等常被写成 &#29238; / &#x7236;，须还原为字符（openpyxl 会解，SheetJS 也会） */
export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (full, hex: string) =>
      codePointToChar(Number.parseInt(hex, 16), full),
    )
    .replace(/&#([0-9]+);/g, (full, dec: string) =>
      codePointToChar(Number.parseInt(dec, 10), full),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseSharedStrings(sstXml: string | null): string[] {
  if (!sstXml) return [];
  const items: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRe.exec(sstXml)) !== null) {
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRe.exec(siMatch[1])) !== null) {
      parts.push(decodeXmlEntities(tMatch[1]));
    }
    items.push(parts.join(''));
  }
  return items;
}

function resolveWorksheetEntryPath(cfb: CFB.CFB$Container, sheetIndex: number): string | null {
  const workbookXml = readCfbEntryText(cfb, '/xl/workbook.xml');
  if (!workbookXml) {
    return sheetIndex === 0 ? '/xl/worksheets/sheet1.xml' : null;
  }

  const sheetRelIds: string[] = [];
  const sheetTagRe = /<sheet\b[^>]*\br:id="([^"]+)"[^>]*\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  while ((sheetMatch = sheetTagRe.exec(workbookXml)) !== null) {
    sheetRelIds.push(sheetMatch[1]);
  }
  if (sheetIndex >= sheetRelIds.length) {
    return null;
  }

  const relsXml = readCfbEntryText(cfb, '/xl/_rels/workbook.xml.rels');
  if (!relsXml) {
    return `/xl/worksheets/sheet${sheetIndex + 1}.xml`;
  }

  const relId = sheetRelIds[sheetIndex];
  const relRe = new RegExp(
    `<Relationship\\b[^>]*\\bId="${relId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*\\bTarget="([^"]+)"`,
    'i',
  );
  const relMatch = relRe.exec(relsXml);
  if (!relMatch) {
    return `/xl/worksheets/sheet${sheetIndex + 1}.xml`;
  }

  const target = relMatch[1].replace(/^\//, '');
  return target.startsWith('xl/') ? `/${target}` : `/xl/${target}`;
}

export function colLettersToIndex(letters: string): number {
  let n = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i += 1) {
    n = n * 26 + (upper.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function decodeA1Address(address: string): { r: number; c: number } | null {
  const match = /^\$?([A-Za-z]+)\$?([0-9]+)$/.exec(address.trim());
  if (!match) return null;
  return { r: Number(match[2]) - 1, c: colLettersToIndex(match[1]) };
}

function parseWorksheetCells(
  sheetXml: string,
  sharedStrings: string[],
): Map<string, string> {
  const map = new Map<string, string>();
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheetXml)) !== null) {
    const rowAttrs = rowMatch[1];
    const rowInner = rowMatch[2];
    const rowNumMatch = /\br="(\d+)"/.exec(rowAttrs);
    const rowIndex0 = rowNumMatch ? Number(rowNumMatch[1]) - 1 : null;
    let nextCol = 0;

    const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowInner)) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2] ?? '';
      const fullAddressMatch = /\br="([A-Za-z]+[0-9]+)"/.exec(attrs);
      const colOnlyMatch =
        !fullAddressMatch && rowIndex0 != null ? /\br="([A-Za-z]+)"/.exec(attrs) : null;
      let addr = fullAddressMatch?.[1] ?? '';
      if (!addr && colOnlyMatch) {
        // WPS 等工具常见 r="F"（仅列字母），须与当前行号拼成 F3，否则会按 nextCol 误落到 E 列
        addr = `${colOnlyMatch[1]}${rowIndex0 + 1}`;
      }
      if (!addr && rowIndex0 != null) {
        // 无 r 时按行内顺序推进列
        const col = nextCol;
        const letters = (() => {
          let n = col + 1;
          let s = '';
          while (n > 0) {
            const rem = (n - 1) % 26;
            s = String.fromCharCode(65 + rem) + s;
            n = Math.floor((n - 1) / 26);
          }
          return s;
        })();
        addr = `${letters}${rowIndex0 + 1}`;
      }
      if (!addr) continue;

      const decoded = decodeA1Address(addr);
      if (decoded) nextCol = decoded.c + 1;

      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = typeMatch?.[1] ?? '';

      if (cellType === 's') {
        const valueMatch = /<v>([^<]*)<\/v>/.exec(inner);
        if (!valueMatch) continue;
        const idx = Number(valueMatch[1]);
        if (!Number.isInteger(idx) || idx < 0 || idx >= sharedStrings.length) continue;
        map.set(addr.toUpperCase(), sharedStrings[idx]);
        continue;
      }

      if (cellType === 'inlineStr' || cellType === 'str') {
        const inlineMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(inner);
        const valueMatch = /<v>([^<]*)<\/v>/.exec(inner);
        const text = inlineMatch
          ? decodeXmlEntities(inlineMatch[1])
          : valueMatch
            ? decodeXmlEntities(valueMatch[1])
            : '';
        map.set(addr.toUpperCase(), text);
        continue;
      }

      const valueMatch = /<v>([^<]*)<\/v>/.exec(inner);
      if (!valueMatch || valueMatch[1] === '') continue;
      map.set(addr.toUpperCase(), valueMatch[1]);
    }
  }
  return map;
}

/** A1 → 原始字符串 */
export function readXlsxWorksheetRawValues(
  buffer: ArrayBuffer,
  sheetIndex = 0,
): Map<string, string> {
  const cfb = CFB.read(new Uint8Array(buffer), { type: 'array' });
  const sheetPath = resolveWorksheetEntryPath(cfb, sheetIndex);
  if (!sheetPath) {
    return new Map();
  }
  const sheetXml = readCfbEntryText(cfb, sheetPath);
  if (!sheetXml) {
    return new Map();
  }
  const sharedStrings = parseSharedStrings(readCfbEntryText(cfb, '/xl/sharedStrings.xml'));
  return parseWorksheetCells(sheetXml, sharedStrings);
}

/** 直接把工作表解析为字符串矩阵（不经过 SheetJS） */
export function readXlsxWorksheetStringMatrix(
  buffer: ArrayBuffer,
  sheetIndex = 0,
): string[][] {
  const values = readXlsxWorksheetRawValues(buffer, sheetIndex);
  if (values.size === 0) {
    return [];
  }

  let maxR = 0;
  let maxC = 0;
  const cells: Array<{ r: number; c: number; v: string }> = [];
  for (const [addr, value] of values) {
    const decoded = decodeA1Address(addr);
    if (!decoded) continue;
    cells.push({ r: decoded.r, c: decoded.c, v: value });
    if (decoded.r > maxR) maxR = decoded.r;
    if (decoded.c > maxC) maxC = decoded.c;
  }

  const rows: string[][] = Array.from({ length: maxR + 1 }, () =>
    Array.from({ length: maxC + 1 }, () => ''),
  );
  for (const cell of cells) {
    rows[cell.r][cell.c] = cell.v;
  }
  return rows;
}
