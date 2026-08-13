/**
 * DWG/DXF 解析（浏览器端）：DWG 用 libredwg-web，DXF 用 dxf-parser
 */

import { createModule, Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
import DxfParser from 'dxf-parser';
import { hasValidSvgViewBox, normalizeCadSvg } from './cad2dPreviewSvg';
import { fetchCoreFileBytes } from './fetchCoreFileBytes';
import { yieldToMain } from './yieldToMain';

export { normalizeCadSvg } from './cad2dPreviewSvg';

export type Cad2dParseResult = {
  svg?: string;
  imageDataUrl?: string;
  format: 'dwg' | 'dxf';
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function thumbnailToDataUrl(thumbnail: { data: Uint8Array; type: number }): string | null {
  if (!thumbnail.data?.length) return null;
  const mime = thumbnail.type === 6 ? 'image/png' : 'image/bmp';
  return `data:${mime};base64,${uint8ToBase64(thumbnail.data)}`;
}

type LibreDwgInstance = Awaited<ReturnType<typeof LibreDwg.create>>;

let libredwgPromise: Promise<LibreDwgInstance> | null = null;

async function loadLibreDwg(): Promise<LibreDwgInstance> {
  if (!libredwgPromise) {
    libredwgPromise = (async () => {
      const wasmUrl = `${import.meta.env.BASE_URL}libredwg-web.wasm`;
      const wasmInstance = await createModule({
        locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
      });
      return LibreDwg.createByWasmInstance(wasmInstance);
    })().catch((err) => {
      libredwgPromise = null;
      throw err;
    });
  }
  return libredwgPromise;
}

async function parseDwgBufferAsync(buffer: ArrayBuffer): Promise<Omit<Cad2dParseResult, 'format'>> {
  const lib = await loadLibreDwg();
  const ptr = lib.dwg_read_data(buffer, Dwg_File_Type.DWG);
  if (!ptr) {
    throw new Error('DWG parse failed');
  }
  try {
    const db = lib.convert(ptr);
    const rawSvg = lib.dwg_to_svg(db);
    const svg = rawSvg?.trim() ? normalizeCadSvg(rawSvg) : '';
    if (svg && hasValidSvgViewBox(svg)) {
      return { svg };
    }

    const thumbnail = lib.dwg_bmp(ptr);
    const imageDataUrl = thumbnail ? thumbnailToDataUrl(thumbnail) : null;
    if (imageDataUrl) {
      return { imageDataUrl };
    }

    const dxfBytes = lib.dwg_write_dxf(buffer);
    if (dxfBytes?.length) {
      const dxfText = new TextDecoder('utf-8').decode(dxfBytes);
      const dxfSvg = normalizeCadSvg(parseDxfText(dxfText));
      if (dxfSvg) {
        return { svg: dxfSvg };
      }
    }

    if (svg) {
      return { svg };
    }
    throw new Error('DWG produced empty drawing');
  } finally {
    lib.dwg_free(ptr);
  }
}

function arcToPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  let delta = endDeg - startDeg;
  if (delta < 0) delta += 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${x1} ${-y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${-y2}`;
}

function entityToSvg(entity: Record<string, unknown>): string {
  const type = String(entity.type ?? '').toUpperCase();
  const color = '#333333';

  switch (type) {
    case 'LINE': {
      const start = entity.start as { x: number; y: number } | undefined;
      const end = entity.end as { x: number; y: number } | undefined;
      if (!start || !end) return '';
      return `<line x1="${start.x}" y1="${-start.y}" x2="${end.x}" y2="${-end.y}" stroke="${color}" />`;
    }
    case 'CIRCLE': {
      const center = entity.center as { x: number; y: number } | undefined;
      const radius = entity.radius as number | undefined;
      if (!center || radius == null) return '';
      return `<circle cx="${center.x}" cy="${-center.y}" r="${radius}" fill="none" stroke="${color}" />`;
    }
    case 'ARC': {
      const center = entity.center as { x: number; y: number } | undefined;
      const radius = entity.radius as number | undefined;
      const startAngle = entity.startAngle as number | undefined;
      const endAngle = entity.endAngle as number | undefined;
      if (!center || radius == null || startAngle == null || endAngle == null) return '';
      return `<path d="${arcToPath(center.x, center.y, radius, startAngle, endAngle)}" fill="none" stroke="${color}" />`;
    }
    case 'LWPOLYLINE': {
      const vertices = entity.vertices as Array<{ x: number; y: number }> | undefined;
      if (!vertices?.length) return '';
      const points = vertices.map((v) => `${v.x},${-v.y}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}" />`;
    }
    case 'POLYLINE': {
      const vertices = entity.vertices as Array<{ x: number; y: number }> | undefined;
      if (!vertices?.length) return '';
      const points = vertices.map((v) => `${v.x},${-v.y}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}" />`;
    }
    case 'SPLINE': {
      const controlPoints = entity.controlPoints as Array<{ x: number; y: number }> | undefined;
      if (!controlPoints?.length) return '';
      const points = controlPoints.map((v) => `${v.x},${-v.y}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}" />`;
    }
    case 'ELLIPSE': {
      const center = entity.center as { x: number; y: number } | undefined;
      const majorAxisEndPoint = entity.majorAxisEndPoint as { x: number; y: number } | undefined;
      const axisRatio = entity.axisRatio as number | undefined;
      if (!center || !majorAxisEndPoint || axisRatio == null) return '';
      const rx = Math.hypot(majorAxisEndPoint.x, majorAxisEndPoint.y);
      const ry = rx * axisRatio;
      const rot = (Math.atan2(majorAxisEndPoint.y, majorAxisEndPoint.x) * 180) / Math.PI;
      return `<ellipse cx="${center.x}" cy="${-center.y}" rx="${rx}" ry="${ry}" transform="rotate(${-rot} ${center.x} ${-center.y})" fill="none" stroke="${color}" />`;
    }
    default:
      return '';
  }
}

function parseDxfText(text: string): string {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text);
  const entities = (dxf?.entities ?? []) as unknown as Record<string, unknown>[];
  const shapes = entities.map(entityToSvg).filter(Boolean);
  if (!shapes.length) {
    throw new Error('DXF produced empty drawing');
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const nums = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  for (const n of nums) {
    if (!Number.isFinite(n)) continue;
    minX = Math.min(minX, n);
    maxX = Math.max(maxX, n);
    minY = Math.min(minY, n);
    maxY = Math.max(maxY, n);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1000;
    maxY = 1000;
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.05 || 10;
  const vbX = minX - pad;
  const vbY = -(maxY + pad);
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><g stroke="#000000" fill="none" transform="matrix(1,0,0,-1,0,0)">${shapes.join('')}</g></svg>`;
}

export async function parseCad2dFromBuffer(buffer: ArrayBuffer, ext: 'dwg' | 'dxf'): Promise<Cad2dParseResult> {
  if (ext === 'dwg') {
    const result = await parseDwgBufferAsync(buffer);
    return { ...result, format: 'dwg' };
  }
  const text = new TextDecoder('utf-8').decode(buffer);
  const svg = normalizeCadSvg(parseDxfText(text));
  return { svg, format: 'dxf' };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function parseCad2dFromUrl(
  fileUrl: string,
  ext: 'dwg' | 'dxf',
  fileUuid?: string,
): Promise<Cad2dParseResult> {
  const bytes = await fetchCoreFileBytes({
    fileUrl,
    fileUuid,
    errorLabel: 'CAD load failed',
  });
  await yieldToMain();
  return parseCad2dFromBuffer(toArrayBuffer(bytes), ext);
}

export async function parseCad2dFromUuid(
  fileUuid: string,
  ext: 'dwg' | 'dxf',
): Promise<Cad2dParseResult> {
  const bytes = await fetchCoreFileBytes({
    fileUuid,
    errorLabel: 'CAD load failed',
  });
  await yieldToMain();
  return parseCad2dFromBuffer(toArrayBuffer(bytes), ext);
}
