/**
 * 快格轻EMS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 能源监测页面
import EnergyMonitoringsPage from './pages/energy-monitorings';

// 能耗分析页面
import EnergyConsumptionAnalysesPage from './pages/energy-consumption-analyses';

// 节能管理页面
import EnergySavingManagementsPage from './pages/energy-saving-managements';

// 能源报表页面
import EnergyReportsPage from './pages/energy-reports';

const KuaiemsApp: React.FC = () => {
  return (
    <Routes>
      {/* 能源监测 */}
      <Route path="energy-monitorings" element={<EnergyMonitoringsPage />} />
      
      {/* 能耗分析 */}
      <Route path="energy-consumption-analyses" element={<EnergyConsumptionAnalysesPage />} />
      
      {/* 节能管理 */}
      <Route path="energy-saving-managements" element={<EnergySavingManagementsPage />} />
      
      {/* 能源报表 */}
      <Route path="energy-reports" element={<EnergyReportsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻EMS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiemsApp;

