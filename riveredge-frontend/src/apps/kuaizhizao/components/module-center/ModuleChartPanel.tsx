import React from 'react';
import { Card, Col, Row, Segmented, Spin } from 'antd';

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
  return (
    <Col xs={24} lg={lg}>
      <Card
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
        style={{ borderRadius: 12 }}
        styles={{ body: { padding: '12px 16px 8px', minHeight: height } }}
      >
        <Spin spinning={!!loading}>{children}</Spin>
      </Card>
    </Col>
  );
}

export function ModuleChartRow({ children }: { children: React.ReactNode }) {
  return (
    <Row gutter={[16, 16]} style={{ width: '100%' }}>
      {children}
    </Row>
  );
}

export default ModuleChartPanel;
