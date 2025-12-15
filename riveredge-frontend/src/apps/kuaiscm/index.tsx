/**
 * 快格轻SCM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 供应链网络页面
import SupplyChainNetworksPage from './pages/supply-chain-networks';

// 需求预测页面
import DemandForecastsPage from './pages/demand-forecasts';

// 供应链风险页面
import SupplyChainRisksPage from './pages/supply-chain-risks';

// 全局库存视图页面
import GlobalInventoryViewsPage from './pages/global-inventory-views';

const KuaiscmApp: React.FC = () => {
  return (
    <Routes>
      {/* 供应链网络管理 */}
      <Route path="networks" element={<SupplyChainNetworksPage />} />
      
      {/* 需求预测协同 */}
      <Route path="forecasts" element={<DemandForecastsPage />} />
      
      {/* 供应链风险预警 */}
      <Route path="risks" element={<SupplyChainRisksPage />} />
      
      {/* 全局库存可视化 */}
      <Route path="inventory-views" element={<GlobalInventoryViewsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻SCM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiscmApp;

