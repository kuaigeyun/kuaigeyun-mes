/**
 * 文件预览批注类型（viewBox 坐标系，不修改源 CAD/PCB 文件）
 */

export type PreviewMarkupTool = 'pan' | 'rect' | 'arrow' | 'text';

export type PreviewMarkupScope = 'default' | 'top' | 'bottom';

export type PreviewMarkupRectShape = {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
};

export type PreviewMarkupArrowShape = {
  id: string;
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
};

export type PreviewMarkupTextShape = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fill?: string;
  fontSize?: number;
};

export type PreviewMarkupShape =
  | PreviewMarkupRectShape
  | PreviewMarkupArrowShape
  | PreviewMarkupTextShape;

export type PreviewMarkupPayload = {
  version: 1;
  coordinate_space: 'viewBox';
  viewBox?: string | null;
  shapes: PreviewMarkupShape[];
};

export type PreviewMarkupResponse = {
  file_uuid: string;
  scope: PreviewMarkupScope;
  payload: PreviewMarkupPayload;
  updated_by?: number | null;
  updated_at?: string | null;
};

export function createEmptyMarkupPayload(viewBox?: string | null): PreviewMarkupPayload {
  return {
    version: 1,
    coordinate_space: 'viewBox',
    viewBox: viewBox ?? null,
    shapes: [],
  };
}

export function parseSvgViewBox(svg: string): { viewBox: string; width: number; height: number } | null {
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return {
        viewBox: viewBoxMatch[1].trim(),
        width: parts[2],
        height: parts[3],
      };
    }
  }
  const widthMatch = svg.match(/\bwidth=["']([\d.]+)/i);
  const heightMatch = svg.match(/\bheight=["']([\d.]+)/i);
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1]);
    const height = Number(heightMatch[1]);
    if (width > 0 && height > 0) {
      return {
        viewBox: `0 0 ${width} ${height}`,
        width,
        height,
      };
    }
  }
  return null;
}

export function createMarkupShapeId(): string {
  return `mk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
