/**
 * 路由配置
 *
 * 统一使用 SaaS 模式
 * 单体部署本质上就是只有 maintree，没有新建其他租户 tree
 * 
 * 路由结构：
 * - 公开页面：/login, /register/*
 * - 系统级路由（/system/*）：用户登录后访问
 *   - /system/dashboard - 系统仪表盘
 *   - /system/roles - 角色管理
 *   - /system/permissions - 权限管理
 *   - /system/departments - 部门管理
 *   - /system/positions - 职位管理
 *   - /system/users - 账户管理
 * - 平台级路由（/platform/*）：平台超管登录后访问
 *   - /platform/operation - 平台运营看板
 *   - /platform/tenants - 租户管理
 *   - /platform/packages - 套餐管理
 *   - /platform/monitoring - 监控管理
 *   - /platform/admin - 平台超级管理员管理
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
// 系统级功能页面
import RoleListPage from '../../tree-stem/pages/system/roles/list';
import PermissionListPage from '../../tree-stem/pages/system/permissions/list';
import DepartmentListPage from '../../tree-stem/pages/system/departments/list';
import PositionListPage from '../../tree-stem/pages/system/positions/list';
import UserListPage from '../../tree-stem/pages/system/users/list';
import DataDictionaryListPage from '../../tree-stem/pages/system/data-dictionaries/list';
import SystemParameterListPage from '../../tree-stem/pages/system/system-parameters/list';
import CodeRuleListPage from '../../tree-stem/pages/system/code-rules/list';
import CustomFieldListPage from '../../tree-stem/pages/system/custom-fields/list';
import SiteSettingsPage from '../../tree-stem/pages/system/site-settings';
import InvitationCodeListPage from '../../tree-stem/pages/system/invitation-codes/list';
import LanguageListPage from '../../tree-stem/pages/system/languages/list';
import ApplicationListPage from '../../tree-stem/pages/system/applications/list';
import IntegrationConfigListPage from '../../tree-stem/pages/system/integration-configs/list';

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
      {/* 系统级功能 */}
      {/* 角色管理 */}
      <Route
        path="/system/roles"
        element={
          <LayoutWrapper>
            <RoleListPage />
          </LayoutWrapper>
        }
      />
      {/* 权限管理 */}
      <Route
        path="/system/permissions"
        element={
          <LayoutWrapper>
            <PermissionListPage />
          </LayoutWrapper>
        }
      />
      {/* 部门管理 */}
      <Route
        path="/system/departments"
        element={
          <LayoutWrapper>
            <DepartmentListPage />
          </LayoutWrapper>
        }
      />
      {/* 职位管理 */}
      <Route
        path="/system/positions"
        element={
          <LayoutWrapper>
            <PositionListPage />
          </LayoutWrapper>
        }
      />
      {/* 账户管理 */}
      <Route
        path="/system/users"
        element={
          <LayoutWrapper>
            <UserListPage />
          </LayoutWrapper>
        }
      />
      {/* 数据字典管理 */}
      <Route
        path="/system/data-dictionaries"
        element={
          <LayoutWrapper>
            <DataDictionaryListPage />
          </LayoutWrapper>
        }
      />
      {/* 系统参数管理 */}
      <Route
        path="/system/system-parameters"
        element={
          <LayoutWrapper>
            <SystemParameterListPage />
          </LayoutWrapper>
        }
      />
      {/* 编码规则管理 */}
      <Route
        path="/system/code-rules"
        element={
          <LayoutWrapper>
            <CodeRuleListPage />
          </LayoutWrapper>
        }
      />
      {/* 自定义字段管理 */}
      <Route
        path="/system/custom-fields"
        element={
          <LayoutWrapper>
            <CustomFieldListPage />
          </LayoutWrapper>
        }
      />
      {/* 站点设置 */}
      <Route
        path="/system/site-settings"
        element={
          <LayoutWrapper>
            <SiteSettingsPage />
          </LayoutWrapper>
        }
      />
      {/* 邀请码管理 */}
      <Route
        path="/system/invitation-codes"
        element={
          <LayoutWrapper>
            <InvitationCodeListPage />
          </LayoutWrapper>
        }
      />
      {/* 语言管理 */}
      <Route
        path="/system/languages"
        element={
          <LayoutWrapper>
            <LanguageListPage />
          </LayoutWrapper>
        }
      />
      {/* 应用中心 */}
      <Route
        path="/system/applications"
        element={
          <LayoutWrapper>
            <ApplicationListPage />
          </LayoutWrapper>
        }
      />
      {/* 集成设置 */}
      <Route
        path="/system/integration-configs"
        element={
          <LayoutWrapper>
            <IntegrationConfigListPage />
          </LayoutWrapper>
        }
      />

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
      {/* 旧的系统级路由重定向 */}
      <Route path="/login/dashboard" element={<Navigate to="/system/dashboard" replace />} />
      <Route path="/login/system" element={<Navigate to="/system/dashboard" replace />} />
      <Route path="/login/system/users" element={<Navigate to="/system/users" replace />} />
      <Route path="/login/system/roles" element={<Navigate to="/system/roles" replace />} />
      <Route path="/login/system/permissions" element={<Navigate to="/system/permissions" replace />} />
      <Route path="/login/system/departments" element={<Navigate to="/system/departments" replace />} />
      <Route path="/login/system/positions" element={<Navigate to="/system/positions" replace />} />
      {/* 旧的用户管理路由（如果存在） */}
      <Route path="/users" element={<Navigate to="/system/users" replace />} />
      <Route path="/system/users/list" element={<Navigate to="/system/users" replace />} />
      {/* 旧的角色管理路由（如果存在） */}
      <Route path="/roles" element={<Navigate to="/system/roles" replace />} />
      <Route path="/system/roles/list" element={<Navigate to="/system/roles" replace />} />
      {/* 旧的权限管理路由（如果存在） */}
      <Route path="/permissions" element={<Navigate to="/system/permissions" replace />} />
      <Route path="/system/permissions/list" element={<Navigate to="/system/permissions" replace />} />
      {/* 旧的部门管理路由（如果存在） */}
      <Route path="/departments" element={<Navigate to="/system/departments" replace />} />
      <Route path="/system/departments/list" element={<Navigate to="/system/departments" replace />} />
      {/* 旧的职位管理路由（如果存在） */}
      <Route path="/positions" element={<Navigate to="/system/positions" replace />} />
      <Route path="/system/positions/list" element={<Navigate to="/system/positions" replace />} />
      
      {/* 旧的平台级路由重定向 */}
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

