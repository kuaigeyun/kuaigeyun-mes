import React from 'react';
import { Row, Col, Spin } from 'antd';
import { UniDashboard } from '../../../../components/uni-dashboard';
import { MODULE_CENTER_GUTTER } from './constants';

export interface ModuleCenterLayoutProps {
  loading?: boolean;
  kpiRow: React.ReactNode;
  shortcutRow: React.ReactNode;
  actionRow: React.ReactNode;
  chartRow?: React.ReactNode;
}

export function ModuleCenterLayout({
  loading,
  kpiRow,
  shortcutRow,
  actionRow,
  chartRow,
}: ModuleCenterLayoutProps) {
  return (
    <UniDashboard style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={!!loading}>
        <Row gutter={[MODULE_CENTER_GUTTER, MODULE_CENTER_GUTTER]}>
          <Col span={24}>{kpiRow}</Col>
          <Col span={24}>{shortcutRow}</Col>
          {actionRow}
          {chartRow}
        </Row>
      </Spin>
    </UniDashboard>
  );
}

export default ModuleCenterLayout;
