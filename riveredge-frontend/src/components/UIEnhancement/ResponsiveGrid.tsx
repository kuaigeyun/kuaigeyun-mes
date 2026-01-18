/**
 * 响应式网格组件
 *
 * 提供响应式网格布局，自动适配不同屏幕尺寸。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import React from 'react';
import { Row, Col } from 'antd';
import { ResponsiveHelper } from '@/utils/uiEnhancement';
import type { RowProps, ColProps } from 'antd';

interface ResponsiveGridProps extends RowProps {
  /** 桌面端列数 */
  desktopColumns?: number;
  /** 平板端列数 */
  tabletColumns?: number;
  /** 移动端列数 */
  mobileColumns?: number;
  /** 子元素 */
  children: React.ReactNode;
}

/**
 * 响应式网格组件
 */
const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  desktopColumns = 3,
  tabletColumns = 2,
  mobileColumns = 1,
  children,
  ...props
}) => {
  const colProps = ResponsiveHelper.getResponsiveColumns(
    Math.floor(24 / desktopColumns),
    Math.floor(24 / tabletColumns),
    Math.floor(24 / mobileColumns)
  );

  return (
    <Row {...props}>
      {React.Children.map(children, (child, index) => (
        <Col key={index} {...colProps}>
          {child}
        </Col>
      ))}
    </Row>
  );
};

export default ResponsiveGrid;
