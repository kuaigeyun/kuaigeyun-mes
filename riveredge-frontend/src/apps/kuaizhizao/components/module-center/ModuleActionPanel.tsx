import React from 'react';
import { Col, theme } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { MODULE_PANEL_TITLE_STYLE } from './constants';

export interface ModuleActionPanelProps {
  title: string;
  extra?: React.ReactNode;
  lg?: number;
  xs?: number;
  children: React.ReactNode;
  loading?: boolean;
  /** ModuleActionMasonry balanced 装箱权重；默认 2 */
  masonryWeight?: number;
  /** grid：Ant Row 栅格；masonry：ModuleActionMasonry 纵列瀑布流内块 */
  layout?: 'grid' | 'masonry';
}

export function ModuleActionPanel({
  title,
  extra,
  lg = 12,
  xs = 24,
  children,
  loading,
  layout = 'grid',
}: ModuleActionPanelProps) {
  const { token } = theme.useToken();
  const card = (
    <ProCard
      className="detail-drawer-section-title-accent"
      title={title}
      headerBordered
      bordered
      loading={loading}
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        ...(layout === 'grid' ? { height: '100%' } : {}),
      }}
      styles={{
        header: { minHeight: 48, paddingBlock: 12, paddingInline: 16 },
        title: MODULE_PANEL_TITLE_STYLE,
        body: { padding: 8 },
      }}
      extra={extra}
    >
      {children}
    </ProCard>
  );

  if (layout === 'masonry') {
    return (
      <div
        style={{
          width: '100%',
          minWidth: 0,
        }}
      >
        {card}
      </div>
    );
  }

  return (
    <Col xs={xs} lg={lg} style={{ minWidth: 0 }}>
      {card}
    </Col>
  );
}

export default ModuleActionPanel;
ModuleActionPanel.displayName = 'ModuleActionPanel';
