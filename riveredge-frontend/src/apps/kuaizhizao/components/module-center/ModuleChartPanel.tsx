import React from 'react';
import { Card, Col, Segmented, Spin, theme } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

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
}

export function ModuleChartPanel({
  title,
  extra,
  segmented,
  loading,
  height = 280,
  children,
  lg = 12,
}: ModuleChartPanelProps) {
  const { token } = theme.useToken();
  const titleNode =
    typeof title === 'string' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <BarChartOutlined />
        <span>{title}</span>
      </span>
    ) : (
      title
    );

  return (
    <Col xs={24} lg={lg} style={{ display: 'flex', minWidth: 0 }}>
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
        style={{ borderRadius: token.borderRadiusLG, width: '100%', height: '100%' }}
        styles={{
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
    </Col>
  );
}

/** 图表区与 actionRow 共用外层 Row 栅格，勿再嵌套 Row */
export function ModuleChartRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default ModuleChartPanel;
