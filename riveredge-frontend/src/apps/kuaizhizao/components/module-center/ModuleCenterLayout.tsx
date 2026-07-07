import React from 'react';
import { Row, Col, Spin } from 'antd';
import { UniDashboard } from '../../../../components/uni-dashboard';
import { MODULE_CENTER_GUTTER } from './constants';

export interface ModuleCenterLayoutProps {
  loading?: boolean;
  kpiRow: React.ReactNode;
  /** 省略则不展示快捷入口行（普通看板常用） */
  shortcutRow?: React.ReactNode;
  /** 独占整行内容（如研发甘特图），渲染在 shortcutRow 之后、actionRow 之前 */
  fullWidthRow?: React.ReactNode;
  actionRow?: React.ReactNode;
  chartRow?: React.ReactNode;
  /** 默认 true；财务/经营分析等普通看板可设为 false 去掉右侧工作台栏 */
  showSidebar?: boolean;
}

export function ModuleCenterLayout({
  loading,
  kpiRow,
  shortcutRow,
  fullWidthRow,
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
          {fullWidthRow ? (
            <Col span={24} style={{ minWidth: 0 }}>
              {fullWidthRow}
            </Col>
          ) : null}
          {actionRow}
          {chartRow}
        </Row>
      </Spin>
    </UniDashboard>
  );
}

export default ModuleCenterLayout;
