import React from 'react';
import { Card, Col, Segmented, Spin, theme } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import {
  MODULE_PANEL_TITLE_ICON_SIZE,
  MODULE_PANEL_TITLE_STYLE,
  MODULE_CENTER_GUTTER,
} from './constants';

export interface ModuleChartPanelProps {
  title: React.ReactNode;
  extra?: React.ReactNode;
  segmented?: {
    value: string;
    options: { label: string; value: string }[];
    onChange: (v: string) => void;
  };
  loading?: boolean;
  height?: number;
  children: React.ReactNode;
  lg?: number;
  /** grid：Ant Row 栅格；masonry：配合 ModuleActionMasonry 瀑布流 */
  layout?: 'grid' | 'masonry';
}

export function ModuleChartPanel({
  title,
  extra,
  segmented,
  loading,
  height = 280,
  children,
  lg = 12,
  layout = 'grid',
}: ModuleChartPanelProps) {
  const { token } = theme.useToken();
  const titleNode =
    typeof title === 'string' ? (
      <span style={{ ...MODULE_PANEL_TITLE_STYLE, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <BarChartOutlined style={{ fontSize: MODULE_PANEL_TITLE_ICON_SIZE }} />
        <span>{title}</span>
      </span>
    ) : (
      title
    );

  const card = (
    <Card
      title={titleNode}
      extra={
        segmented ? (
          <Segmented
            size="small"
            value={segmented.value}
            options={segmented.options}
            onChange={(v) => segmented.onChange(String(v))}
          />
        ) : (
          extra
        )
      }
      style={{
        borderRadius: token.borderRadiusLG,
        width: '100%',
        ...(layout === 'grid' ? { height: '100%' } : {}),
      }}
      styles={{
        header: {
          minHeight: 48,
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorSplit}`,
        },
        title: MODULE_PANEL_TITLE_STYLE,
        body: {
          padding: '12px 16px 8px',
          minHeight: height,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Spin spinning={!!loading} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Spin>
    </Card>
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
    <Col xs={24} lg={lg} style={{ display: 'flex', minWidth: 0 }}>
      {card}
    </Col>
  );
}

/** 图表区与 actionRow 共用外层 Row 栅格，勿再嵌套 Row */
export function ModuleChartRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default ModuleChartPanel;
