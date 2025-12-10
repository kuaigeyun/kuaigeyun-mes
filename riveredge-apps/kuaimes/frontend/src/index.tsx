/**
 * 快格轻MES 插件入口
 *
 * 导出插件路由配置和组件
 */

import React from 'react';
import { Route, Routes } from 'react-router-dom';

// 懒加载页面组件
const OrderListPage = React.lazy(() => import('./pages/orders/list'));
const WorkOrderListPage = React.lazy(() => import('./pages/workorders/list'));
const ProgressPage = React.lazy(() => import('./pages/progress'));

/**
 * 插件路由配置
 */
export const KuaimesRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/orders" element={<OrderListPage />} />
      <Route path="/workorders" element={<WorkOrderListPage />} />
      <Route path="/progress" element={<ProgressPage />} />
    </Routes>
  );
};

/**
 * 插件元数据
 */
export const pluginMetadata = {
  name: '快格轻MES',
  code: 'kuaimes',
  version: '1.0.0',
  routePath: '/apps/kuaimes',
};

// 默认导出（ES Module 格式）
export default KuaimesRoutes;

