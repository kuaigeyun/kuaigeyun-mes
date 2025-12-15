/**
 * 快格轻CRM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 线索管理页面
import LeadsPage from './pages/leads';

// 商机管理页面
import OpportunitiesPage from './pages/opportunities';

// 销售漏斗页面
import FunnelPage from './pages/funnel';

// 订单管理页面
import SalesOrdersPage from './pages/sales-orders';

// 客户服务页面
import ServicePage from './pages/service';

// 销售分析页面
import AnalysisPage from './pages/analysis';

const KuaicrmApp: React.FC = () => {
  return (
    <Routes>
      {/* 线索管理 */}
      <Route path="leads" element={<LeadsPage />} />
      <Route path="leads/list" element={<LeadsPage />} />
      
      {/* 商机管理 */}
      <Route path="opportunities" element={<OpportunitiesPage />} />
      <Route path="opportunities/list" element={<OpportunitiesPage />} />
      
      {/* 销售漏斗 */}
      <Route path="funnel" element={<FunnelPage />} />
      
      {/* 订单管理 */}
      <Route path="sales-orders" element={<SalesOrdersPage />} />
      <Route path="sales-orders/list" element={<SalesOrdersPage />} />
      
      {/* 客户服务 */}
      <Route path="service" element={<ServicePage />} />
      
      {/* 销售分析 */}
      <Route path="analysis" element={<AnalysisPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻CRM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaicrmApp;
