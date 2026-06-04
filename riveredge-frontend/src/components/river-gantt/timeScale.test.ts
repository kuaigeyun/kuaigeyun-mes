import { describe, it, expect } from 'vitest';
import {
  formatScaleString,
  isoWeek,
  buildScaleRows,
  getMinUnit,
  getUnitMs,
} from './timeScale';
import type { RiverGanttScale } from './types';

describe('formatScaleString', () => {
  it('格式化年月日', () => {
    const d = new Date(2026, 5, 4); // 2026-06-04
    expect(formatScaleString('%Y年%m月', d)).toBe('2026年06月');
    expect(formatScaleString('%m月', d)).toBe('06月');
    expect(formatScaleString('%d', d)).toBe('04');
    expect(formatScaleString('%Y年', d)).toBe('2026年');
  });

  it('保留字面量与转义', () => {
    const d = new Date(2026, 0, 9);
    expect(formatScaleString('第%W周', d)).toBe(`第${isoWeek(d)}周`);
    expect(formatScaleString('100%%', d)).toBe('100%');
  });
});

describe('isoWeek', () => {
  it('已知日期的 ISO 周序号', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // 2026-01-01 周四 → 第1周
    expect(isoWeek(new Date(2026, 0, 5))).toBe(2); // 2026-01-05 周一 → 第2周
  });
});

describe('getMinUnit / getUnitMs', () => {
  it('取最末（最小）刻度单位', () => {
    const scales: RiverGanttScale[] = [
      { unit: 'month', step: 1, format: '%m' },
      { unit: 'day', step: 1, format: '%d' },
    ];
    expect(getMinUnit(scales)).toBe('day');
    expect(getUnitMs('day')).toBe(24 * 60 * 60 * 1000);
    expect(getUnitMs('week')).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('buildScaleRows', () => {
  it('按天生成日单元格，宽度等于 cellWidth', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 4); // 3 天
    const cellWidth = 40;
    const pxPerMs = cellWidth / getUnitMs('day');
    const rows = buildScaleRows([{ unit: 'day', step: 1, format: '%d' }], start, end, pxPerMs);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells).toHaveLength(3);
    expect(rows[0].cells[0].label).toBe('01');
    expect(Math.round(rows[0].cells[0].width)).toBe(cellWidth);
    expect(rows[0].cells[0].left).toBe(0);
    expect(Math.round(rows[0].cells[1].left)).toBe(cellWidth);
  });

  it('多行刻度：月行 + 日行', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 3);
    const pxPerMs = 40 / getUnitMs('day');
    const rows = buildScaleRows(
      [
        { unit: 'month', step: 1, format: '%Y年%m月' },
        { unit: 'day', step: 1, format: '%d' },
      ],
      start,
      end,
      pxPerMs
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].cells[0].label).toBe('2026年06月');
    expect(rows[1].cells).toHaveLength(2);
  });
});
