/**
 * 快格轻TMS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 运输计划页面
import TransportDemandsPage from './pages/transport-demands';
import TransportPlansPage from './pages/transport-plans';

// 车辆调度页面
import VehicleDispatchesPage from './pages/vehicle-dispatches';

// 运输执行页面
import TransportExecutionsPage from './pages/transport-executions';

// 运费结算页面
import FreightSettlementsPage from './pages/freight-settlements';

const KuaitmsApp: React.FC = () => {
  return (
    <Routes>
      {/* 运输计划 */}
      <Route path="planning/demand" element={<TransportDemandsPage />} />
      <Route path="planning/plan" element={<TransportPlansPage />} />
      
      {/* 车辆调度 */}
      <Route path="dispatch/plan" element={<VehicleDispatchesPage />} />
      <Route path="dispatch/execution" element={<VehicleDispatchesPage />} />
      
      {/* 运输执行 */}
      <Route path="execution/loading" element={<TransportExecutionsPage />} />
      <Route path="execution/tracking" element={<TransportExecutionsPage />} />
      <Route path="execution/sign" element={<TransportExecutionsPage />} />
      
      {/* 运费结算 */}
      <Route path="settlement/calculate" element={<FreightSettlementsPage />} />
      <Route path="settlement/process" element={<FreightSettlementsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻TMS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaitmsApp;

