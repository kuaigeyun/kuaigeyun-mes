import React from 'react';
import { Empty } from 'antd';

/** Phase 2：上图下表图表区占位 */
export const UniReportChartPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  if (children) return <>{children}</>;
  return <Empty description="Chart panel (Phase 2)" style={{ display: 'none' }} />;
};

export default UniReportChartPanel;
