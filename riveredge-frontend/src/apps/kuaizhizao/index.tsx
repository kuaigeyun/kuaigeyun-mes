/**
 * 快格轻制造 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 计划管理页面
import DemandManagementPage from './pages/plan-management/demand-management';
import SchedulingPage from './pages/plan-management/scheduling';

// 生产执行页面
import WorkOrdersPage from './pages/production-execution/work-orders';
import ReportingPage from './pages/production-execution/reporting';

// 仓储管理页面
import InventoryPage from './pages/warehouse-management/inventory';
import InboundPage from './pages/warehouse-management/inbound';
import OutboundPage from './pages/warehouse-management/outbound';

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={<DemandManagementPage />} />
      <Route path="plan-management/scheduling" element={<SchedulingPage />} />

      {/* 生产执行路由 */}
      <Route path="production-execution/work-orders" element={<WorkOrdersPage />} />
      <Route path="production-execution/reporting" element={<ReportingPage />} />

      {/* 仓储管理路由 */}
      <Route path="warehouse-management/inventory" element={<InventoryPage />} />
      <Route path="warehouse-management/inbound" element={<InboundPage />} />
      <Route path="warehouse-management/outbound" element={<OutboundPage />} />

      {/* 默认路由 - 应用首页 */}
      <Route path="" element={
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2>快格轻制造</h2>
          <p>轻量级MES系统 - 专注生产执行核心流程</p>
        </div>
      } />
    </Routes>
  );
};

export default KuaizhizaoApp;
