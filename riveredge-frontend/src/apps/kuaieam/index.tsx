/**
 * 快格轻EAM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 维护计划页面
import MaintenancePlansPage from './pages/maintenance-plans';

// 维护工单页面
import MaintenanceWorkOrdersPage from './pages/maintenance-workorders';

// 维护执行页面
import MaintenanceExecutionsPage from './pages/maintenance-executions';

// 故障报修页面
import FailureReportsPage from './pages/failure-reports';

// 故障处理页面
import FailureHandlingsPage from './pages/failure-handlings';

// 备件需求页面
import SparePartDemandsPage from './pages/spare-part-demands';

// 备件采购页面
import SparePartPurchasesPage from './pages/spare-part-purchases';

// 工装夹具使用页面
import ToolingUsagesPage from './pages/tooling-usages';

// 模具使用页面
import MoldUsagesPage from './pages/mold-usages';

const KuaieamApp: React.FC = () => {
  return (
    <Routes>
      {/* 维护管理 */}
      <Route path="maintenance/plans" element={<MaintenancePlansPage />} />
      <Route path="maintenance/workorders" element={<MaintenanceWorkOrdersPage />} />
      <Route path="maintenance/executions" element={<MaintenanceExecutionsPage />} />
      
      {/* 故障管理 */}
      <Route path="failure/reports" element={<FailureReportsPage />} />
      <Route path="failure/handlings" element={<FailureHandlingsPage />} />
      
      {/* 备件管理 */}
      <Route path="spare-parts/demands" element={<SparePartDemandsPage />} />
      <Route path="spare-parts/purchases" element={<SparePartPurchasesPage />} />
      
      {/* 工装模具管理 */}
      <Route path="tooling/usages" element={<ToolingUsagesPage />} />
      <Route path="mold/usages" element={<MoldUsagesPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻EAM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaieamApp;

