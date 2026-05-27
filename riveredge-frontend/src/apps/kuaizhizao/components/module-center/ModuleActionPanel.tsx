import React from 'react';
import { Col } from 'antd';
import { ProCard } from '@ant-design/pro-components';

export interface ModuleActionPanelProps {
  title: string;
  extra?: React.ReactNode;
  lg?: number;
  xs?: number;
  children: React.ReactNode;
  loading?: boolean;
}

export function ModuleActionPanel({
  title,
  extra,
  lg = 12,
  xs = 24,
  children,
  loading,
}: ModuleActionPanelProps) {
  return (
    <Col xs={xs} lg={lg} style={{ minWidth: 0 }}>
      <ProCard
        title={title}
        headerBordered
        loading={loading}
        style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
        bodyStyle={{ padding: 8 }}
        extra={extra}
      >
        {children}
      </ProCard>
    </Col>
  );
}

export default ModuleActionPanel;
