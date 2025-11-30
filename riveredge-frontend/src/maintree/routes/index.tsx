/**
 * 路由配置
 *
 * 统一使用 SaaS 模式
 * 单体部署本质上就是只有 maintree，没有新建其他租户 tree
 * 
 * 路由结构（按照思维导图）：
 * - Login 分支：登录后的系统级路由（/login/*）
 *   - /login/dashboard - 仪表盘
 *   - /login/apps/... - 应用菜单
 *   - /login/system/... - 系统功能
 * - platform(maintree) 分支：平台级路由（/platform/*）
 *   - /platform/dashboard - 平台仪表盘
 *   - /platform/apps/... - 平台应用
 *   - /platform/system/... - 平台系统功能
 *   - /platform/platform/organization_manager - 组织管理
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// 从 tree-stem 导入所有页面、组件和服务
import BasicLayout from '../../tree-stem/layouts/BasicLayout';
import IndexPage from '../../tree-stem/pages';
import LoginPage from '../../tree-stem/pages/login';
import RegisterPage from '../../tree-stem/pages/register';
import PersonalRegisterPage from '../../tree-stem/pages/register/personal';
import OrganizationRegisterPage from '../../tree-stem/pages/register/organization';
import SystemDashboardPage from '../../tree-stem/pages/system/dashboard';
import NotFoundPage from '../../tree-stem/pages/404';
// 平台级页面
import PlatformLoginPage from '../../tree-stem/pages/platform/login';
import PlatformDashboardPage from '../../tree-stem/pages/platform/operation';
import TenantListPage from '../../tree-stem/pages/platform/tenants/list';
import TenantDetailPage from '../../tree-stem/pages/platform/tenants/detail';
// 平台超级管理员页面
import PlatformSuperAdminPage from '../../tree-stem/pages/platform';
import PackageManagementPage from '../../tree-stem/pages/platform/packages';
import MonitoringPage from '../../tree-stem/pages/platform/monitoring';

// 布局包装组件
const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BasicLayout>
      {children}
    </BasicLayout>
  );
};

/**
 * 路由配置
 *
 * 按照新的页面结构组织路由：
 * - /login - 用户登录
 * - /register/* - 注册页面
 * - /system/* - 系统级功能（登录后访问）
 * - /platform/* - 平台级功能（平台超管登录后访问）
 */
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 首页重定向 */}
      <Route path="/" element={<IndexPage />} />

      {/* ==================== 公开页面 ==================== */}
      {/* 用户登录 */}
      <Route path="/login" element={<LoginPage />} />
      {/* 注册页面 */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/personal" element={<PersonalRegisterPage />} />
      <Route path="/register/organization" element={<OrganizationRegisterPage />} />
      {/* 平台超管登录 */}
      <Route path="/platform" element={<PlatformLoginPage />} />

      {/* ==================== 系统级路由（用户登录后访问） ==================== */}
      {/* 系统仪表盘 */}
      <Route
        path="/system/dashboard"
        element={
          <LayoutWrapper>
            <SystemDashboardPage />
          </LayoutWrapper>
        }
      />
      {/* 系统功能待建设 */}

      {/* ==================== 平台级路由（平台超管登录后访问） ==================== */}
      {/* 平台运营看板 */}
      <Route
        path="/platform/operation"
        element={
          <LayoutWrapper>
            <PlatformDashboardPage />
          </LayoutWrapper>
        }
      />
      {/* 租户管理 */}
      <Route
        path="/platform/tenants"
        element={
          <LayoutWrapper>
            <TenantListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/platform/tenants/detail"
        element={
          <LayoutWrapper>
            <TenantDetailPage />
          </LayoutWrapper>
        }
      />
      {/* 套餐管理 */}
      <Route
        path="/platform/packages"
        element={
          <LayoutWrapper>
            <PackageManagementPage />
          </LayoutWrapper>
        }
      />
      {/* 监控管理 */}
      <Route
        path="/platform/monitoring"
        element={
          <LayoutWrapper>
            <MonitoringPage />
          </LayoutWrapper>
        }
      />
      {/* 平台超级管理员管理 */}
      <Route
        path="/platform/admin"
        element={
          <LayoutWrapper>
            <PlatformSuperAdminPage />
          </LayoutWrapper>
        }
      />

      {/* ==================== 兼容旧路由（重定向到新路由） ==================== */}
      {/* 旧的用户登录路由重定向 */}
      <Route path="/login/dashboard" element={<Navigate to="/system/dashboard" replace />} />
      {/* 旧的平台路由重定向 */}
      <Route path="/platform/dashboard" element={<Navigate to="/platform/operation" replace />} />
      <Route path="/platform/p_dashboard" element={<Navigate to="/platform/operation" replace />} />
      <Route path="/platform/login" element={<Navigate to="/platform" replace />} />
      <Route path="/platform/platform/organization_manager" element={<Navigate to="/platform/tenants" replace />} />
      <Route path="/platform/platform/organization_manager/detail" element={<Navigate to="/platform/tenants/detail" replace />} />
      <Route path="/platform-superadmin" element={<Navigate to="/platform/admin" replace />} />

      {/* 404页面 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;

