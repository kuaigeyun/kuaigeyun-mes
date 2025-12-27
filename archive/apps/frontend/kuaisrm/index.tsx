/**
 * 快格轻SRM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 采购订单页面
import PurchaseOrdersPage from './pages/purchase-orders';

// 委外订单页面
import OutsourcingOrdersPage from './pages/outsourcing-orders';

// 供应商评估页面
import SupplierEvaluationsPage from './pages/supplier-evaluations';

// 采购合同页面
import PurchaseContractsPage from './pages/purchase-contracts';

const KuaisrmApp: React.FC = () => {
  return (
    <Routes>
      {/* 采购订单 */}
      <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
      <Route path="purchase/create" element={<PurchaseOrdersPage />} />
      <Route path="purchase/tracking" element={<PurchaseOrdersPage />} />
      
      {/* 委外订单 */}
      <Route path="outsourcing/orders" element={<OutsourcingOrdersPage />} />
      <Route path="outsourcing/tracking" element={<OutsourcingOrdersPage />} />
      <Route path="outsourcing/progress" element={<OutsourcingOrdersPage />} />
      
      {/* 供应商评估 */}
      <Route path="evaluation/manage" element={<SupplierEvaluationsPage />} />
      <Route path="evaluation/reports" element={<SupplierEvaluationsPage />} />
      
      {/* 采购合同 */}
      <Route path="contracts" element={<PurchaseContractsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻SRM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaisrmApp;
