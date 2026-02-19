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
 * - BasicLayout 统一管理，系统级和应用级路由共享同一个布局实例，避免页面刷新
 */

import React, { Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import BasicLayout from '../layouts/BasicLayout';
// 系统核心路由（不依赖应用加载）
import SystemRoutes from './SystemRoutes';
// 应用业务路由（异步加载，隔离错误）
import AppRoutes from './AppRoutes';
import PageSkeleton from '../components/page-skeleton';

// 报表/大屏分享页（按需加载，避免 kuaireport 进入主包）
const ReportSharedView = React.lazy(() => import('../apps/kuaireport/pages/ReportSharedView'));
const DashboardSharedView = React.lazy(() => import('../apps/kuaireport/pages/DashboardSharedView'));

/**
 * 判断当前路径是否需要 BasicLayout
 * 
 * 不需要 BasicLayout 的路径：
 * - /: 首页
 * - /login: 系统登录页
 * - /infra/login: 平台登录页
 * - /lock-screen: 锁定屏幕
 * - /init/*: 初始化向导页面
 */
const useShouldRenderLayout = (): boolean => {
  const location = useLocation();
  const pathname = location.pathname;

  // 不需要 BasicLayout 的路径列表
  const publicRoutes = ['/', '/login', '/infra/login', '/lock-screen'];
  const publicRoutePrefixes = ['/init/'];
  // 报表/大屏分享页（全屏展示，无需布局）
  const sharedViewPaths = ['/apps/kuaireport/dashboards/shared', '/apps/kuaireport/reports/shared'];

  // 检查是否是公开路由
  if (publicRoutes.includes(pathname)) {
    return false;
  }

  // 检查是否是公开路由前缀
  if (publicRoutePrefixes.some(prefix => pathname.startsWith(prefix))) {
    return false;
  }

  // 分享页全屏展示
  if (sharedViewPaths.includes(pathname)) {
    return false;
  }

  // 其他所有路由都需要 BasicLayout
  return true;
};

/**
 * 主路由组件
 *
 * 采用系统层与应用层完全隔离的架构：
 * - SystemRoutes: 系统核心功能，立即可用
 * - AppRoutes: 业务应用，异步加载，可降级
 * - BasicLayout: 统一提升到主路由层级，避免路由切换时重新挂载
 * 
 * 根据路径判断是否需要 BasicLayout：
 * - 公开路由（登录页、初始化等）：不包裹 BasicLayout，直接渲染 SystemRoutes
 * - 系统级和应用级路由：统一包裹 BasicLayout，共享同一个布局实例
 */
const MainRoutes: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const shouldRenderLayout = useShouldRenderLayout();

  return (
    <>
      {shouldRenderLayout ? (
        <BasicLayout>
          <Routes>
            {/* 应用业务路由 - 异步加载，失败不影响系统 */}
            {/* ⚠️ 重要：必须放在 SystemRoutes 之前，确保 /apps/* 路径优先匹配 */}
            <Route path="/apps/*" element={<AppRoutes />} />

            {/* 系统核心路由 - 立即可用，不依赖应用加载 */}
            {/* ⚠️ 注意：SystemRoutes 中的路由已经移除了 BasicLayout 包裹，直接返回页面组件 */}
            <Route path="/*" element={<SystemRoutes />} />
          </Routes>
        </BasicLayout>
      ) : (
        <Routes>
          {/* 报表/大屏分享页 - 按需加载，全屏展示 */}
          <Route path="/apps/kuaireport/dashboards/shared" element={<Suspense fallback={<PageSkeleton />}><DashboardSharedView /></Suspense>} />
          <Route path="/apps/kuaireport/reports/shared" element={<Suspense fallback={<PageSkeleton />}><ReportSharedView /></Suspense>} />
          {/* 公开路由 - 不需要 BasicLayout，直接渲染 SystemRoutes */}
          <Route path="/*" element={<SystemRoutes />} />
        </Routes>
      )}
    </>
  );
};

export default MainRoutes;