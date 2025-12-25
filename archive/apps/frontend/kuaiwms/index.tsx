/**
 * 快格轻WMS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 库存管理页面
import InventoriesPage from './pages/inventories';

// 入库单页面
import InboundOrdersPage from './pages/inbound-orders';

// 出库单页面
import OutboundOrdersPage from './pages/outbound-orders';

// 盘点单页面
import StocktakesPage from './pages/stocktakes';

// 库存调整页面
import InventoryAdjustmentsPage from './pages/inventory-adjustments';

const KuaiwmsApp: React.FC = () => {
  return (
    <Routes>
      {/* 库存管理 */}
      <Route path="inventory/realtime" element={<InventoriesPage />} />
      <Route path="inventory/adjustment" element={<InventoryAdjustmentsPage />} />
      <Route path="inventory/stocktake" element={<StocktakesPage />} />
      
      {/* 入库管理 */}
      <Route path="inbound/purchase" element={<InboundOrdersPage />} />
      <Route path="inbound/production" element={<InboundOrdersPage />} />
      <Route path="inbound/outsourcing" element={<InboundOrdersPage />} />
      <Route path="inbound/inspection" element={<InboundOrdersPage />} />
      
      {/* 出库管理 */}
      <Route path="outbound/sales" element={<OutboundOrdersPage />} />
      <Route path="outbound/production" element={<OutboundOrdersPage />} />
      <Route path="outbound/outsourcing" element={<OutboundOrdersPage />} />
      <Route path="outbound/picking" element={<OutboundOrdersPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻WMS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiwmsApp;
