/**
 * 快格轻MES APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 生产订单页面
import OrdersPage from './pages/orders';

// 工单页面
import WorkOrdersPage from './pages/workorders';

// 生产报工页面
import ProductionReportsPage from './pages/production-reports';

// 生产追溯页面
import TraceabilitiesPage from './pages/traceabilities';

// 返修工单页面
import ReworkOrdersPage from './pages/rework-orders';

// 进度跟踪页面
import ProgressPage from './pages/progress';

const KuaimesApp: React.FC = () => {
  return (
    <Routes>
      {/* 生产订单 */}
      <Route path="planning/workorders" element={<WorkOrdersPage />} />
      <Route path="planning/scheduling" element={<OrdersPage />} />
      
      {/* 生产执行 */}
      <Route path="execution/reporting" element={<ProductionReportsPage />} />
      <Route path="execution/progress" element={<ProgressPage />} />
      
      {/* 质量管控 */}
      <Route path="quality/traceability" element={<TraceabilitiesPage />} />
      <Route path="quality/defects" element={<ReworkOrdersPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻MES</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaimesApp;

