/**
 * 扩展 pdfme 表格：当列 key 为 `image_url` 且单元格为 http(s)、站点相对路径（如 /api/.../files/...）或 data:image 时，
 * 在 PDF 中嵌入图片而非当作文本（默认 @pdfme/schemas table 仅渲染文字）。
 * 与 print_service 配合：报价单 print-variables 已优先下发 `data:image/*;base64,...`，无需再 fetch。
 * 其它单据若仍为 http(s)/相对下载 URL，则在此拉取并嵌入。
 *
 * 说明：`@pdfme/schemas` 的 package exports 未暴露内部子路径，故用相对路径指向
 * `node_modules` 内 ESM 构建产物（与 Vite 直接解析文件一致）。
 * 升级 @pdfme/schemas 时建议对照 node_modules 内 tables/pdfRender.ts 复核。
 */
import type { PDFRenderProps, Schema, BasePdf, CommonOptions } from '@pdfme/common';
import { image } from '@pdfme/schemas';
import { Cell, Column, Row, Table } from '../../../node_modules/@pdfme/schemas/dist/esm/src/tables/classes.js';
import { rectangle } from '../../../node_modules/@pdfme/schemas/dist/esm/src/shapes/rectAndEllipse.js';
import cell from '../../../node_modules/@pdfme/schemas/dist/esm/src/tables/cell.js';
import { getBody } from '../../../node_modules/@pdfme/schemas/dist/esm/src/tables/helper.js';
import { createSingleTable } from '../../../node_modules/@pdfme/schemas/dist/esm/src/tables/tableHelper.js';
import { getToken } from '../../utils/auth';

/** 与 pdfme TableSchema 对齐的最小类型（避免依赖未导出的 types 路径） */
type TableSchema = Schema & {
  columns?: { key?: string; label?: string }[];
  __bodyRange?: unknown;
};

interface CreateTableArgs {
  schema: Schema;
  basePdf: BasePdf;
  options: CommonOptions;
  _cache: Map<string | number, unknown>;
}

type Pos = { x: number; y: number };

/**
 * pdfme 的 getBodyWithRange 内部使用 arr.slice(start, end)。
 * 当 end 为 null 时，JS 会把 null 转成 0，slice(0,0) 变成空表体（仅表头可见）。
 * 将 null/undefined 的 end 视为「截到末尾」，并对错误的 {start:0,end:0} 在有数据时回退为全量行。
 */
function resolveBodyRowsForPdf(
  value: string,
  range: { start?: number | null; end?: number | null } | null | undefined,
): string[][] {
  const full = getBody(value) as string[][];
  if (!Array.isArray(full)) return [];
  if (!range || typeof range !== 'object') return full;

  const start = typeof range.start === 'number' && !Number.isNaN(range.start) ? range.start : 0;
  const endRaw = range.end;

  if (endRaw === null || endRaw === undefined) {
    return full.slice(start);
  }
  const end = typeof endRaw === 'number' && !Number.isNaN(endRaw) ? endRaw : 0;
  if (start === 0 && end === 0 && full.length > 0) {
    return full;
  }
  return full.slice(start, end);
}

const rectanglePdfRender = rectangle.pdf;
const cellPdfRender = cell.pdf;

const IMAGE_COLUMN_KEYS = new Set(['image_url', 'imageUrl', 'product_image']);

function isImageColumnKey(key: string | undefined): boolean {
  if (!key) return false;
  if (IMAGE_COLUMN_KEYS.has(key)) return true;
  return key.toLowerCase().includes('image');
}

/** 设计器里常见只有 label、未持久化 key 的列 */
function columnLabelSuggestsImage(col: { key?: string; label?: string } | undefined): boolean {
  if (!col) return false;
  const lab = String(col.label ?? '').trim();
  return /图片|图像|照片|附图/i.test(lab);
}

/**
 * 与 RiverEdge 文件下载接口形态一致时，即使列未配置 key 也按图片拉取（避免整格渲染长 URL 文本）
 */
function isLikelyFileDownloadImageUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t.startsWith('/') && !/^https?:\/\//i.test(t)) return false;
  return /\/(files|file)\b/i.test(t) && (/download/i.test(t) || /[?&]token=/i.test(t));
}

function shouldEmbedImageInTableCell(
  cellObj: Cell,
  col: { key?: string; label?: string } | undefined,
): boolean {
  const raw = (cellObj.raw ?? '').trim();
  if (cellObj.section === 'head') return false;
  if (!looksLikeImageSource(raw)) return false;
  if (isImageColumnKey(col?.key) || columnLabelSuggestsImage(col)) return true;
  return isLikelyFileDownloadImageUrl(raw);
}

function looksLikeImageSource(raw: string): boolean {
  const t = extractFirstUrlIfList(raw).trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  // 协议相对 URL
  if (/^\/\//.test(t)) return true;
  if (/^data:image\//i.test(t)) return true;
  if (t.startsWith('/') && (t.includes('/files/') || t.includes('/file') || t.includes('download') || t.startsWith('/api/'))) {
    return true;
  }
  return false;
}

function extractFirstUrlIfList(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  // Try to parse JSON array of strings or objects
  try {
    if (t.startsWith('[') && t.endsWith(']')) {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === 'string') t = first;
        else if (first && typeof first === 'object' && first.url) t = first.url;
      }
    }
  } catch { /* ignore */ }
  // Try to split by comma in case it's a comma separated URLs string
  if (t.includes(',')) {
    t = t.split(',')[0].trim();
  }
  return t;
}

/** 将相对路径转为可在当前环境 fetch 的 URL（浏览器下相对路径即可） */
function resolveFetchUrl(src: string): string {
  const t = src.trim();
  if (t.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${t}`;
  }
  return t;
}



/** 与 apiRequest 一致：Bearer + X-Tenant-ID（仅靠 cookie 时部分环境会 401） */
function getPdfmeFileFetchHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  try {
    const tid = localStorage.getItem('tenant_id');
    if (tid?.trim()) h['X-Tenant-ID'] = tid.trim();
  } catch {
    /* ignore */
  }
  return h;
}

/** 图片加载失败时生成占位图（灰底+交叉线） */
function createImagePlaceholderDataUrl(): string {
  try {
    if (typeof document === 'undefined') return '';
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(size - 4, size - 4);
    ctx.moveTo(size - 4, 4);
    ctx.lineTo(4, size - 4);
    ctx.stroke();
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function sniffIsJpeg(buf: ArrayBuffer): boolean {
  const u8 = new Uint8Array(buf.slice(0, 3));
  return u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
}

function sniffIsPng(buf: ArrayBuffer): boolean {
  const u8 = new Uint8Array(buf.slice(0, 4));
  return u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
}

/**
 * pdfme image 插件仅支持 PNG/JPEG 嵌入；WebP/GIF 等先转 PNG（与 imagehelper 能力对齐）
 */
async function bufferToPdfmeCompatibleDataUrl(buf: ArrayBuffer, contentType: string): Promise<{
  dataUrl: string;
  convertedToPng: boolean;
}> {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  const isPng = ct.includes('png') || sniffIsPng(buf);
  const isJpeg = ct.includes('jpeg') || ct.includes('jpg') || sniffIsJpeg(buf);
  if (isPng || isJpeg) {
    const mime = isPng ? 'image/png' : 'image/jpeg';
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { dataUrl: `data:${mime};base64,${btoa(binary)}`, convertedToPng: false };
  }
  if (typeof createImageBitmap === 'undefined') {
    throw new Error(`PDF 仅支持 PNG/JPEG，当前 Content-Type: ${contentType || 'unknown'}`);
  }
  const blobType = ct || 'image/webp';
  const blob = new Blob([buf], { type: blobType });
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 不可用');
  ctx.drawImage(bmp, 0, 0);
  try {
    bmp.close();
  } catch {
    /* ignore */
  }
  return { dataUrl: canvas.toDataURL('image/png'), convertedToPng: true };
}

/** fetch 远程图片为 data URL，供 pdf 嵌入 */
async function fetchImageAsDataUrl(src: string): Promise<string> {
  src = extractFirstUrlIfList(src);
  if (/^data:image\//i.test(src)) return src;
  
  let resolved = resolveFetchUrl(src);
  
  // Forcefully extract 36-char UUID and reconstruct the clean download URL to avoid any garbage characters
  const uuidRegexMatch = src.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  if (uuidRegexMatch) {
    const cleanUuid = uuidRegexMatch[1];
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    if (origin) {
      resolved = `${origin}/api/v1/core/files/${cleanUuid}/download`;
    }
  }

  const url = resolved;
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      headers: getPdfmeFileFetchHeaders(),
    });
  } catch (err: any) {
    throw new Error(`请求异常: ${err.message}`);
  }
  
  if (!res.ok) {
    // Show full URL without origin to see if there is any garbage in the UUID string
    throw new Error(`${res.status} ${url.replace(window.location.origin, '')}`);
  }
  const buf = await res.arrayBuffer();
  const rawCt = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ct =
    rawCt ||
    (sniffIsJpeg(buf) ? 'image/jpeg' : sniffIsPng(buf) ? 'image/png' : 'application/octet-stream');
  const looksHtml =
    ct.toLowerCase().includes('text/html') ||
    (buf.byteLength > 0 &&
      buf.byteLength < 8192 &&
      new TextDecoder().decode(new Uint8Array(buf.slice(0, 256))).trimStart().startsWith('<'));
  if (looksHtml) {
    throw new Error('返回内容为 HTML（可能未登录或 token 无效），非图片');
  }
  const { dataUrl } = await bufferToPdfmeCompatibleDataUrl(buf, ct);
  return dataUrl;
}

async function drawImageInCell(arg: PDFRenderProps<TableSchema>, cellObj: Cell) {
  const raw = (cellObj.raw || '').trim();
  if (!looksLikeImageSource(raw)) {
    await drawDefaultCell(arg, cellObj);
    return;
  }
  let dataUrl: string;
  try {
    dataUrl = await fetchImageAsDataUrl(raw);
  } catch (e) {
    console.warn('[pdfme table] image fetch failed:', e, raw);
    // 图片不存在时渲染占位图（灰底+交叉线），不影响其他列数据展示
    const placeholder = createImagePlaceholderDataUrl();
    if (placeholder) {
      dataUrl = placeholder;
      // 直接走到下方图片渲染逻辑
    } else {
      await drawDefaultCell(arg, cellObj, '');
      return;
    }
  }

  const position = { x: cellObj.x, y: cellObj.y };
  const { width, height } = cellObj;
  const borderWidth = cellObj.styles.lineWidth;
  const padding = cellObj.styles.cellPadding;

  await cellPdfRender({
    ...arg,
    value: '',
    schema: {
      name: '',
      type: 'cell',
      position,
      width,
      height,
      fontName: cellObj.styles.fontName,
      alignment: cellObj.styles.alignment,
      verticalAlignment: cellObj.styles.verticalAlignment,
      fontSize: cellObj.styles.fontSize,
      lineHeight: cellObj.styles.lineHeight,
      characterSpacing: cellObj.styles.characterSpacing,
      backgroundColor: cellObj.styles.backgroundColor,
      fontColor: cellObj.styles.textColor,
      borderColor: cellObj.styles.lineColor,
      borderWidth: cellObj.styles.lineWidth,
      padding: cellObj.styles.cellPadding,
    },
  });

  const bwLeft = typeof borderWidth === 'object' ? (borderWidth.left || 0) : (typeof borderWidth === 'number' ? borderWidth : 0);
  const bwRight = typeof borderWidth === 'object' ? (borderWidth.right || 0) : (typeof borderWidth === 'number' ? borderWidth : 0);
  const bwTop = typeof borderWidth === 'object' ? (borderWidth.top || 0) : (typeof borderWidth === 'number' ? borderWidth : 0);
  const bwBottom = typeof borderWidth === 'object' ? (borderWidth.bottom || 0) : (typeof borderWidth === 'number' ? borderWidth : 0);

  const pLeft = typeof padding === 'object' ? (padding.left || 0) : (typeof padding === 'number' ? padding : 0);
  const pRight = typeof padding === 'object' ? (padding.right || 0) : (typeof padding === 'number' ? padding : 0);
  const pTop = typeof padding === 'object' ? (padding.top || 0) : (typeof padding === 'number' ? padding : 0);
  const pBottom = typeof padding === 'object' ? (padding.bottom || 0) : (typeof padding === 'number' ? padding : 0);

  const innerX = position.x + bwLeft + pLeft;
  const innerY = position.y + bwTop + pTop;
  const innerW = width - bwLeft - bwRight - pLeft - pRight;
  const innerH = height - bwTop - bwBottom - pTop - pBottom;

  try {
    await image.pdf({
      ...arg,
      value: dataUrl,
      schema: {
        name: '',
        type: 'image',
        position: { x: innerX, y: innerY },
        width: Math.max(1, innerW),
        height: Math.max(1, innerH),
        rotate: 0,
        opacity: 1,
      },
    });
  } catch (imgErr) {
    console.warn('[pdfme table] image.pdf render failed, falling back to empty cell:', imgErr);
    await drawDefaultCell(arg, cellObj, '');
  }
}

async function drawDefaultCell(
  arg: PDFRenderProps<TableSchema>,
  cellObj: Cell,
  valueOverride?: string,
) {
  await cellPdfRender({
    ...arg,
    value: valueOverride ?? cellObj.raw,
    schema: {
      name: '',
      type: 'cell',
      position: { x: cellObj.x, y: cellObj.y },
      width: cellObj.width,
      height: cellObj.height,
      fontName: cellObj.styles.fontName,
      alignment: cellObj.styles.alignment,
      verticalAlignment: cellObj.styles.verticalAlignment,
      fontSize: cellObj.styles.fontSize,
      lineHeight: cellObj.styles.lineHeight,
      characterSpacing: cellObj.styles.characterSpacing,
      backgroundColor: cellObj.styles.backgroundColor,
      fontColor: cellObj.styles.textColor,
      borderColor: cellObj.styles.lineColor,
      borderWidth: cellObj.styles.lineWidth,
      padding: cellObj.styles.cellPadding,
    },
  });
}

async function drawCell(
  arg: PDFRenderProps<TableSchema>,
  tableSchema: TableSchema,
  columnIndex: number,
  cellObj: Cell,
) {
  const col = tableSchema.columns?.[columnIndex] as { key?: string; label?: string } | undefined;
  if (shouldEmbedImageInTableCell(cellObj, col)) {
    await drawImageInCell(arg, cellObj);
    return;
  }
  await drawDefaultCell(arg, cellObj);
}

async function drawRow(
  arg: PDFRenderProps<TableSchema>,
  tableSchema: TableSchema,
  table: Table,
  row: Row,
  cursor: Pos,
  columns: Column[],
) {
  console.debug('[pdfme drawRow] section:', row.section, 'cursor.y:', cursor.y?.toFixed(2), 'row.height:', row.height?.toFixed(2), 'cells:', Object.keys(row.cells).length);
  cursor.x = table.settings.margin.left;
  for (const column of columns) {
    const c = row.cells[column.index];
    if (!c) {
      cursor.x += column.width;
      continue;
    }
    c.x = cursor.x;
    c.y = cursor.y;
    try {
      await drawCell(arg, tableSchema, column.index, c);
    } catch (cellErr) {
      console.error('[pdfme drawRow] drawCell THREW at col', column.index, ':', cellErr);
    }
    cursor.x += column.width;
  }
  cursor.y += row.height;
}

async function drawTableBorder(
  arg: PDFRenderProps<TableSchema>,
  table: Table,
  startPos: Pos,
  cursor: Pos,
) {
  const lineWidth = table.settings.tableLineWidth;
  const lineColor = table.settings.tableLineColor;
  if (!lineWidth || !lineColor) return;
  await rectanglePdfRender({
    ...arg,
    schema: {
      name: '',
      type: 'rectangle',
      borderWidth: lineWidth,
      borderColor: lineColor,
      color: '',
      position: { x: startPos.x, y: startPos.y },
      width: table.getWidth(),
      height: cursor.y - startPos.y,
      readOnly: true,
    },
  });
}

async function drawTable(
  arg: PDFRenderProps<TableSchema>,
  tableSchema: TableSchema,
  table: Table,
): Promise<Pos> {
  const settings = table.settings;
  const startY = settings.startY;
  const margin = settings.margin;
  const cursor = { x: margin.left, y: startY };
  const startPos = Object.assign({}, cursor);

  if (settings.showHead) {
    for (const row of table.head) {
      await drawRow(arg, tableSchema, table, row, cursor, table.columns);
    }
  }

  for (const row of table.body) {
    await drawRow(arg, tableSchema, table, row, cursor, table.columns);
  }

  await drawTableBorder(arg, table, startPos, cursor);
  return cursor;
}

/** 渲染 foot 行（pdfme 原生不支持，由自定义插件补充） */
async function drawFootRow(
  arg: PDFRenderProps<TableSchema>,
  table: Table,
  footData: string[],
  footStyles: Record<string, unknown>,
  startY: number,
): Promise<void> {
  const columns = table.columns;
  const minH = typeof footStyles.minCellHeight === 'number' ? footStyles.minCellHeight : 11;
  const borderWidth = footStyles.borderWidth ?? { top: 0.3, right: 0.3, bottom: 0.3, left: 0.3 };
  const padding = footStyles.padding ?? { top: 4, right: 6, bottom: 4, left: 4 };

  let curX = table.settings.margin.left;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const raw = footData[i] ?? '';
    await cellPdfRender({
      ...arg,
      value: raw,
      schema: {
        name: '',
        type: 'cell',
        position: { x: curX, y: startY },
        width: col.width,
        height: minH,
        fontName: (footStyles.fontName as string) ?? 'NotoSansSC',
        alignment: (footStyles.alignment as string) ?? 'right',
        verticalAlignment: (footStyles.verticalAlignment as string) ?? 'middle',
        fontSize: (footStyles.fontSize as number) ?? 10,
        lineHeight: (footStyles.lineHeight as number) ?? 1.2,
        characterSpacing: 0,
        backgroundColor: (footStyles.backgroundColor as string) ?? '#dce6f4',
        fontColor: (footStyles.fontColor as string) ?? '#000000',
        borderColor: (footStyles.borderColor as string) ?? '#aaaaaa',
        borderWidth: borderWidth as never,
        padding: padding as never,
        readOnly: true,
      },
    });
    curX += col.width;
  }
}

export const tablePdfRenderWithImageUrlColumn = async (arg: PDFRenderProps<TableSchema>) => {
  const { value, schema, basePdf, options, _cache } = arg;
  const tableSchema = schema as TableSchema;

  const strVal = typeof value !== 'string' ? JSON.stringify(value || '[]') : value;
  const body = resolveBodyRowsForPdf(strVal, (schema as any).__bodyRange);

  console.debug('[pdfme render] schema.name:', schema.name, '| __bodyRange:', JSON.stringify((schema as any).__bodyRange), '| strVal(50):', strVal.slice(0, 50), '| body.length:', Array.isArray(body) ? body.length : body);

  const createTableArgs: CreateTableArgs = {
    schema,
    basePdf,
    options,
    _cache,
  };

  const typedBody: string[][] = Array.isArray(body)
    ? body.map((row) => (Array.isArray(row) ? row.map((cellVal) => String(cellVal)) : []))
    : [];

  const table = await createSingleTable(typedBody, createTableArgs);
  console.debug('[pdfme render] table.body.length:', table.body.length);
  const cursor = await drawTable(arg, tableSchema, table);

  // 渲染 foot 行（pdfme 原生不支持 showFoot，由此处补充）
  const rawSchema = schema as Record<string, unknown>;
  const isLastBodyRange = (() => {
    const range = rawSchema.__bodyRange as { start?: number; end?: number } | undefined;
    if (!range) return true;
    const end = range.end ?? typedBody.length;
    return end >= typedBody.length;
  })();
  if (rawSchema.showFoot && Array.isArray(rawSchema.foot) && rawSchema.foot.length > 0 && isLastBodyRange) {
    const footStyles = (rawSchema.footStyles as Record<string, unknown>) ?? {};
    await drawFootRow(arg, table, rawSchema.foot as string[], footStyles, cursor.y);
  }
};
