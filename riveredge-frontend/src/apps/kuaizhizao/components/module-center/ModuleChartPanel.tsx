import React from 'react';
import { Card, Col, Segmented, Spin, theme } from 'antd';
import { MODULE_PANEL_TITLE_STYLE, modulePanelSurfaceStyle } from './constants';

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
  /** ModuleActionMasonry balanced 装箱权重；默认 3 */
  masonryWeight?: number;
  /** 内容区随子元素高度（如研发看板甘特图），body 留 8px 内边距 */
  fitContent?: boolean;
  children: React.ReactNode;
  lg?: number;
  /** grid：Ant Row 栅格；masonry：瀑布流内块；standalone：ModuleCenterLayout fullWidthRow 整行（不再包 Col） */
  layout?: 'grid' | 'masonry' | 'standalone';
}

export function ModuleChartPanel({
  title,
  extra,
  segmented,
  loading,
  height = 280,
  masonryWeight: _masonryWeight,
  fitContent = false,
  children,
  lg = 12,
  layout = 'grid',
}: ModuleChartPanelProps) {
  const { token } = theme.useToken();
  const card = (
    <Card
      variant="borderless"
      className={[
        'module-chart-panel',
        'detail-drawer-section-title-accent',
        fitContent ? 'module-chart-panel--fit-content' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={title}
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
        ...modulePanelSurfaceStyle(token),
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
        body: fitContent
          ? {
              padding: 8,
              display: 'block',
            }
          : {
              padding: '12px 16px 8px',
              minHeight: height,
              display: 'flex',
              flexDirection: 'column',
            },
      }}
    >
      <Spin
        spinning={!!loading}
        style={fitContent ? { display: 'block' } : { flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </Spin>
    </Card>
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

  if (layout === 'standalone') {
    return <div style={{ width: '100%', minWidth: 0 }}>{card}</div>;
  }

  return (
    <Col xs={24} lg={lg} style={{ display: 'flex', minWidth: 0 }}>
      {card}
    </Col>
  );
}

ModuleChartPanel.displayName = 'ModuleChartPanel';

/** 图表区与 actionRow 共用外层 Row 栅格，勿再嵌套 Row */
export function ModuleChartRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default ModuleChartPanel;
