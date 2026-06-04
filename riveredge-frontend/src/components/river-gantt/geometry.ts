/**
 * RiverGantt 几何换算（纯函数，可单测）。
 *
 * 统一「日期 ↔ 像素」映射，供刻度、任务条、分段、依赖连线、今日线/冻结带、拖拽吸附复用。
 */

export const MIN_BAR_PX = 6;

export interface GanttGeometry {
  start: Date;
  end: Date;
  cellWidth: number;
  /** 最小刻度单位标称毫秒数 */
  unitMs: number;
  pxPerMs: number;
  totalWidth: number;
}

export function createGeometry(
  start: Date,
  end: Date,
  cellWidth: number,
  unitMs: number
): GanttGeometry {
  const safeUnitMs = unitMs > 0 ? unitMs : 24 * 60 * 60 * 1000;
  const pxPerMs = cellWidth / safeUnitMs;
  const totalWidth = Math.max(0, (end.getTime() - start.getTime()) * pxPerMs);
  return { start, end, cellWidth, unitMs: safeUnitMs, pxPerMs, totalWidth };
}

export function dateToX(g: GanttGeometry, date: Date): number {
  return (date.getTime() - g.start.getTime()) * g.pxPerMs;
}

export function xToMs(g: GanttGeometry, x: number): number {
  return g.start.getTime() + x / g.pxPerMs;
}

export function xToDate(g: GanttGeometry, x: number): Date {
  return new Date(xToMs(g, x));
}

export interface BarRect {
  left: number;
  width: number;
}

export function barRect(g: GanttGeometry, start: Date, end: Date): BarRect {
  const left = dateToX(g, start);
  const right = dateToX(g, end);
  return { left, width: Math.max(MIN_BAR_PX, right - left) };
}

/** 将拖拽位移吸附到最小刻度单位（日视图→整天；月视图→整周）。 */
export function snapDeltaMs(g: GanttGeometry, deltaMs: number): number {
  return Math.round(deltaMs / g.unitMs) * g.unitMs;
}

/** 将像素位移换算为毫秒位移。 */
export function pxToMs(g: GanttGeometry, px: number): number {
  return px / g.pxPerMs;
}
