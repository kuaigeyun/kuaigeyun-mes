import React, { type ReactNode } from 'react';
import { Row, Col } from 'antd';
import { UniDashboardSidebar, UNI_DASHBOARD_LAYOUT_GUTTER } from './UniDashboardSidebar';

export interface UniDashboardProps {
  /** 左栏：模块工作台业务内容 */
  children: ReactNode;
  /** 是否展示右侧固定栏（日历 / 入口 / 帮助 / 版本） */
  showSidebar?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 通用 APP 模块工作台布局：左栏业务区 + 右栏固定工具区（与系统工作台一致）。
 */
export function UniDashboard({
  children,
  showSidebar = true,
  className,
  style,
}: UniDashboardProps) {
  return (
    <div
      className={className ? `uni-dashboard ${className}` : 'uni-dashboard'}
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      <Row
        gutter={[UNI_DASHBOARD_LAYOUT_GUTTER, UNI_DASHBOARD_LAYOUT_GUTTER]}
        align="stretch"
        className="dashboard-main-body"
        style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}
      >
        <Col
          xs={24}
          lg={showSidebar ? 19 : 24}
          className="dashboard-main-scroll-col"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: UNI_DASHBOARD_LAYOUT_GUTTER,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div className="dashboard-main-scroll-inner">{children}</div>
        </Col>
        {showSidebar ? (
          <Col
            xs={24}
            lg={5}
            className="dashboard-main-scroll-col"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: UNI_DASHBOARD_LAYOUT_GUTTER,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <UniDashboardSidebar />
          </Col>
        ) : null}
      </Row>
    </div>
  );
}
