import React from 'react';
import { Col, Grid } from 'antd';
import { MODULE_CENTER_GUTTER } from './constants';

export interface ModuleActionMasonryProps {
  children: React.ReactNode;
  /** 大屏列数，默认 2 */
  columns?: number;
}

/** action 区瀑布流：卡片按内容高度自然堆叠，避免同行等高留白 */
export function ModuleActionMasonry({ children, columns = 2 }: ModuleActionMasonryProps) {
  const screens = Grid.useBreakpoint();
  const columnCount = screens.lg ? columns : 1;

  return (
    <Col span={24}>
      <div
        style={{
          columnCount,
          columnGap: MODULE_CENTER_GUTTER,
        }}
      >
        {children}
      </div>
    </Col>
  );
}

export default ModuleActionMasonry;
