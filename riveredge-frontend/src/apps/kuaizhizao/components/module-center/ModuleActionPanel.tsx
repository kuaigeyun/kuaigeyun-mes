import React from 'react';
import { Col, theme } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { AppstoreOutlined } from '@ant-design/icons';
import {
  MODULE_PANEL_TITLE_ICON_SIZE,
  MODULE_PANEL_TITLE_STYLE,
  MODULE_CENTER_GUTTER,
} from './constants';

export interface ModuleActionPanelProps {
  title: string;
  extra?: React.ReactNode;
  lg?: number;
  xs?: number;
  children: React.ReactNode;
  loading?: boolean;
  /** grid：Ant Row 栅格；masonry：配合 ModuleActionMasonry 瀑布流 */
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
  const titleNode = (
    <span style={{ ...MODULE_PANEL_TITLE_STYLE, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <AppstoreOutlined style={{ fontSize: MODULE_PANEL_TITLE_ICON_SIZE }} />
      <span>{title}</span>
    </span>
  );

  const card = (
    <ProCard
      title={titleNode}
      headerBordered
      loading={loading}
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)',
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
          breakInside: 'avoid',
          marginBottom: MODULE_CENTER_GUTTER,
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
