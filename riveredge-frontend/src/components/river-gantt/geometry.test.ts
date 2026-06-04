import { describe, it, expect } from 'vitest';
import {
  createGeometry,
  dateToX,
  xToDate,
  barRect,
  snapDeltaMs,
  MIN_BAR_PX,
} from './geometry';

const DAY = 24 * 60 * 60 * 1000;

describe('createGeometry', () => {
  it('依据 cellWidth 与单元毫秒推导 pxPerMs 与总宽', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 11); // 10 天
    const g = createGeometry(start, end, 40, DAY);
    expect(g.pxPerMs).toBeCloseTo(40 / DAY);
    expect(Math.round(g.totalWidth)).toBe(400);
  });
});

describe('dateToX / xToDate', () => {
  it('往返一致', () => {
    const start = new Date(2026, 5, 1);
    const g = createGeometry(start, new Date(2026, 5, 30), 40, DAY);
    const d = new Date(2026, 5, 6, 8, 0, 0);
    const x = dateToX(g, d);
    expect(xToDate(g, x).getTime()).toBe(d.getTime());
  });

  it('起点 x 为 0', () => {
    const start = new Date(2026, 5, 1);
    const g = createGeometry(start, new Date(2026, 5, 30), 40, DAY);
    expect(dateToX(g, start)).toBe(0);
  });
});

describe('barRect', () => {
  it('零宽任务条至少 MIN_BAR_PX', () => {
    const start = new Date(2026, 5, 1);
    const g = createGeometry(start, new Date(2026, 5, 30), 40, DAY);
    const r = barRect(g, start, start);
    expect(r.width).toBe(MIN_BAR_PX);
  });

  it('一天宽度等于 cellWidth', () => {
    const start = new Date(2026, 5, 1);
    const g = createGeometry(start, new Date(2026, 5, 30), 40, DAY);
    const r = barRect(g, start, new Date(2026, 5, 2));
    expect(Math.round(r.width)).toBe(40);
  });
});

describe('snapDeltaMs', () => {
  it('日视图位移吸附到整天', () => {
    const g = createGeometry(new Date(2026, 5, 1), new Date(2026, 5, 30), 40, DAY);
    expect(snapDeltaMs(g, DAY * 1.4)).toBe(DAY);
    expect(snapDeltaMs(g, DAY * 1.6)).toBe(DAY * 2);
    expect(snapDeltaMs(g, -DAY * 0.6)).toBe(-DAY);
  });
});
