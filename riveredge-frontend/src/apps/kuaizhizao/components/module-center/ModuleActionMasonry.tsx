import React, { Children, isValidElement } from 'react';
import { Col, Grid } from 'antd';
import { MODULE_CENTER_GUTTER } from './constants';

export type ModuleMasonryPack = 'roundRobin' | 'balanced';

export interface ModuleActionMasonryProps {
  children: React.ReactNode;
  /** 大屏列数，默认 2 */
  columns?: number;
  /** balanced：按 masonryWeight 装入累计权重较小的列；roundRobin：按序号轮流 */
  pack?: ModuleMasonryPack;
}

const DEFAULT_PANEL_WEIGHT = 2;
const DEFAULT_CHART_WEIGHT = 6;

function resolveMasonryWeight(child: React.ReactNode): number {
  if (!isValidElement(child)) return DEFAULT_PANEL_WEIGHT;
  const props = child.props as { masonryWeight?: number; layout?: string };
  if (typeof props.masonryWeight === 'number' && props.masonryWeight > 0) {
    return props.masonryWeight;
  }
  if (props.layout === 'masonry' && child.type && typeof child.type !== 'string') {
    const name = (child.type as { displayName?: string; name?: string }).displayName
      ?? (child.type as { name?: string }).name
      ?? '';
    if (name.includes('Chart')) return DEFAULT_CHART_WEIGHT;
  }
  return DEFAULT_PANEL_WEIGHT;
}

function distributeRoundRobin(items: React.ReactNode[], columnCount: number): React.ReactNode[][] {
  const cols: React.ReactNode[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((child, index) => {
    cols[index % columnCount].push(child);
  });
  return cols;
}

function distributeBalanced(items: React.ReactNode[], columnCount: number): React.ReactNode[][] {
  const cols: React.ReactNode[][] = Array.from({ length: columnCount }, () => []);
  const weights = new Array(columnCount).fill(0);
  const ranked = items.map((child, index) => ({
    child,
    index,
    weight: resolveMasonryWeight(child),
  }));
  ranked.sort((a, b) => b.weight - a.weight || a.index - b.index);
  ranked.forEach(({ child, weight }) => {
    let target = 0;
    for (let i = 1; i < columnCount; i += 1) {
      if (weights[i] < weights[target]) target = i;
    }
    cols[target].push(child);
    weights[target] += weight;
  });
  return cols;
}

/**
 * 事项区瀑布流：固定列宽的独立纵列，矮卡下方由下一张接上。
 * 禁止 CSS grid 同行拉齐；禁止 CSS column-count（Table / 图表列宽振荡）。
 */
export function ModuleActionMasonry({
  children,
  columns = 2,
  pack = 'balanced',
}: ModuleActionMasonryProps) {
  const screens = Grid.useBreakpoint();
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  const columnCount = screens.lg && items.length > 1 ? columns : 1;
  const cols =
    pack === 'roundRobin' || columnCount === 1
      ? distributeRoundRobin(items, columnCount)
      : distributeBalanced(items, columnCount);

  return (
    <Col span={24}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: MODULE_CENTER_GUTTER,
        }}
      >
        {cols.map((colItems, colIndex) => (
          <div
            key={colIndex}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: MODULE_CENTER_GUTTER,
            }}
          >
            {colItems}
          </div>
        ))}
      </div>
    </Col>
  );
}

export default ModuleActionMasonry;
