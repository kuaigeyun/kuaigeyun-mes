/**
 * 主路由配置 - 系统层与应用层完全隔离架构
 *
 * 核心设计原则：
 * 1. 系统层（SystemRoutes）：核心功能，不依赖应用加载，始终可用
 * 2. 应用层（AppRoutes）：业务应用，异步加载，失败不影响系统
 * 3. 错误隔离：应用层问题不会影响系统层正常工作
 *
 * 架构优势：
 * - 登录后立即可用系统核心功能
 * - 应用加载失败不影响用户正常使用系统
 * - 支持渐进式应用加载，提升用户体验
 * - 系统稳定性大幅提升
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 系统核心路由（不依赖应用加载）
import SystemRoutes from './SystemRoutes';
// 应用业务路由（异步加载，隔离错误）
import AppRoutes from './AppRoutes';

/**
 * 主路由组件
 *
 * 采用系统层与应用层完全隔离的架构：
 * - SystemRoutes: 系统核心功能，立即可用
 * - AppRoutes: 业务应用，异步加载，可降级
 */
const MainRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 应用业务路由 - 异步加载，失败不影响系统 */}
      {/* ⚠️ 重要：必须放在 SystemRoutes 之前，确保 /apps/* 路径优先匹配 */}
      <Route path="/apps/*" element={<AppRoutes />} />

      {/* 系统核心路由 - 立即可用，不依赖应用加载 */}
      <Route path="/*" element={<SystemRoutes />} />
    </Routes>
  );
};

export default MainRoutes;