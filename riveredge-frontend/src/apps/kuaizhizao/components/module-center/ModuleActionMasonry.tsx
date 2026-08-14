import React from 'react';
import { Col, Grid } from 'antd';
import { MODULE_CENTER_GUTTER } from './constants';

export interface ModuleActionMasonryProps {
  children: React.ReactNode;
  /** 大屏列数，默认 2 */
  columns?: number;
}

/**
 * action 区多列：用 grid 固定列宽。
 * 禁止 CSS column-count：列宽随卡片内容回灌，antd Table / 图表在 useLayoutEffect
 * 里量宽会 natural ↔ 限宽同步振荡（生产 React #185，运维看板等模块中心必现）。
 */
export function ModuleActionMasonry({ children, columns = 2 }: ModuleActionMasonryProps) {
  const screens = Grid.useBreakpoint();
  const columnCount = screens.lg ? columns : 1;

  return (
    <Col span={24}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gap: MODULE_CENTER_GUTTER,
          alignItems: 'start',
        }}
      >
        {children}
      </div>
    </Col>
  );
}

export default ModuleActionMasonry;
