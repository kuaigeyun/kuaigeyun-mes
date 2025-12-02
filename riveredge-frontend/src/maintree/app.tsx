/**
 * RiverEdge SaaS 多组织框架 - 主入口应用
 * 
 * 统一使用 SaaS 模式
 * 单体部署本质上就是只有 maintree，没有新建其他租户 tree
 * 
 * 使用现代化 React 生态技术栈：
 * - React 18.3.1 + TypeScript 5.6.3
 * - React Router DOM 6.26.2 (路由管理)
 * - Zustand 5.0.0 (状态管理)
 * - TanStack Query 5.51.1 (数据获取)
 * - Ant Design 5.21.4 + Pro Components 2.8.2 (UI组件)
 */

import React from 'react';
import { App as AntdApp, ConfigProvider, theme, message } from 'antd';
import AppRoutes from './routes';

// 将 Ant Design message 实例注入到全局，供 api.ts 使用
if (typeof window !== 'undefined') {
  window.__ANTD_MESSAGE__ = message;
}

// 主应用组件
export default function App() {

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // 浅色主题算法
        token: {
          // 可以在这里自定义主题token
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <AppRoutes />
      </AntdApp>
    </ConfigProvider>
  );
}

