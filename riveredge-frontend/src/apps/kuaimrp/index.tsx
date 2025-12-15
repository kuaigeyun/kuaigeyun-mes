/**
 * 快格轻MRP APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// MRP计划页面
import MRPPlansPage from './pages/mrp-plans';

// LRP批次页面
import LRPBatchesPage from './pages/lrp-batches';

// 物料需求页面
import MaterialRequirementsPage from './pages/material-requirements';

// 缺料预警页面
import ShortageAlertsPage from './pages/shortage-alerts';

const KuaimrpApp: React.FC = () => {
  return (
    <Routes>
      {/* MRP计算 */}
      <Route path="mrp/demand-summary" element={<MRPPlansPage />} />
      <Route path="mrp/calculate" element={<MRPPlansPage />} />
      <Route path="mrp/plan" element={<MRPPlansPage />} />
      
      {/* LRP计算 */}
      <Route path="lrp/order-breakdown" element={<LRPBatchesPage />} />
      <Route path="lrp/calculate" element={<LRPBatchesPage />} />
      <Route path="lrp/batches" element={<LRPBatchesPage />} />
      
      {/* 需求追溯 */}
      <Route path="traceability/source" element={<MaterialRequirementsPage />} />
      <Route path="traceability/supply-demand" element={<MaterialRequirementsPage />} />
      
      {/* 缺料分析 */}
      <Route path="shortage/alert" element={<ShortageAlertsPage />} />
      <Route path="shortage/analysis" element={<ShortageAlertsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻MRP</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaimrpApp;
