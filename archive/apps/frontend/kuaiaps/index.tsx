/**
 * 快格轻APS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 产能规划页面
import CapacityPlanningsPage from './pages/capacity-plannings';

// 生产计划页面
import ProductionPlansPage from './pages/production-plans';

// 资源调度页面
import ResourceSchedulingsPage from './pages/resource-schedulings';

// 计划调整页面
import PlanAdjustmentsPage from './pages/plan-adjustments';

const KuaiapsApp: React.FC = () => {
  return (
    <Routes>
      {/* 产能规划 */}
      <Route path="capacity-plannings" element={<CapacityPlanningsPage />} />
      
      {/* 生产计划 */}
      <Route path="production-plans" element={<ProductionPlansPage />} />
      
      {/* 资源调度 */}
      <Route path="resource-schedulings" element={<ResourceSchedulingsPage />} />
      
      {/* 计划调整 */}
      <Route path="plan-adjustments" element={<PlanAdjustmentsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻APS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiapsApp;

