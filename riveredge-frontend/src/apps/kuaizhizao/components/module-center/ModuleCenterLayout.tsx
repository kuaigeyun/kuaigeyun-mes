import React from 'react';
import { Row, Col, Spin } from 'antd';
import { UniDashboard } from '../../../../components/uni-dashboard';
import { MODULE_CENTER_GUTTER } from './constants';

export interface ModuleCenterLayoutProps {
  loading?: boolean;
  kpiRow: React.ReactNode;
  /** 省略则不展示快捷入口行（普通看板常用） */
  shortcutRow?: React.ReactNode;
  actionRow?: React.ReactNode;
  chartRow?: React.ReactNode;
  /** 默认 true；财务/经营分析等普通看板可设为 false 去掉右侧工作台栏 */
  showSidebar?: boolean;
}

export function ModuleCenterLayout({
  loading,
  kpiRow,
  shortcutRow,
  actionRow,
  chartRow,
  showSidebar = true,
}: ModuleCenterLayoutProps) {
  return (
    <UniDashboard showSidebar={showSidebar}>
      <Spin spinning={!!loading}>
        <Row gutter={[MODULE_CENTER_GUTTER, MODULE_CENTER_GUTTER]}>
          <Col span={24}>{kpiRow}</Col>
          {shortcutRow ? <Col span={24}>{shortcutRow}</Col> : null}
          {actionRow}
          {chartRow}
        </Row>
      </Spin>
    </UniDashboard>
  );
}

export default ModuleCenterLayout;
