/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BasicLayout from '../layouts/BasicLayout';

// 加载中组件
const LoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh'
  }}>
    <div>加载中...</div>
  </div>
);

// 核心系统页面（立即加载）
import IndexPage from '../pages';
import LoginPage from '../pages/login';
import NotFoundPage from '../pages/404';
import InfraLoginPage from '../pages/infra/login';
import LockScreenPage from '../pages/lock-screen';

// 系统级页面（懒加载）
const DashboardPage = lazy(() => import('../pages/system/dashboard'));
const DashboardAnalysisPage = lazy(() => import('../pages/system/dashboard/analysis'));
const RolesPage = lazy(() => import('../pages/system/roles/list'));
const PermissionsPage = lazy(() => import('../pages/system/permissions/list'));
const DepartmentsPage = lazy(() => import('../pages/system/departments/list'));
const PositionsPage = lazy(() => import('../pages/system/positions/list'));
const UsersPage = lazy(() => import('../pages/system/users/list'));
const UserProfilePage = lazy(() => import('../pages/personal/profile'));
const LanguagesPage = lazy(() => import('../pages/system/languages/list'));
const SiteSettingsPage = lazy(() => import('../pages/system/site-settings'));
const ApplicationCenterPage = lazy(() => import('../pages/system/applications/list'));
const PluginManagerPage = lazy(() => import('../pages/system/plugin-manager'));
const OperationLogsPage = lazy(() => import('../pages/system/operation-logs'));
const LoginLogsPage = lazy(() => import('../pages/system/login-logs'));
const OnlineUsersPage = lazy(() => import('../pages/system/online-users'));
const ScheduledTasksPage = lazy(() => import('../pages/system/scheduled-tasks/list'));
const ScriptsPage = lazy(() => import('../pages/system/scripts/list'));
const PrintDevicesPage = lazy(() => import('../pages/system/print-devices/list'));
const PrintTemplatesPage = lazy(() => import('../pages/system/print-templates/list'));
const CodeRulesPage = lazy(() => import('../pages/system/code-rules/list'));
const DataDictionariesPage = lazy(() => import('../pages/system/data-dictionaries/list'));
const DataSourcesPage = lazy(() => import('../pages/system/data-sources/list'));
const DatasetsPage = lazy(() => import('../pages/system/datasets/list'));
const DataBackupsPage = lazy(() => import('../pages/system/data-backups'));
const CustomFieldsPage = lazy(() => import('../pages/system/custom-fields/list'));
const ApiServicesPage = lazy(() => import('../pages/system/apis/list'));
const IntegrationConfigsPage = lazy(() => import('../pages/system/integration-configs/list'));
const MessageTemplatesPage = lazy(() => import('../pages/system/messages/template'));
const MessageConfigsPage = lazy(() => import('../pages/system/messages/config'));
const InngestDashboardPage = lazy(() => import('../pages/infra/inngest'));

// 平台级页面（懒加载）
const PlatformOperationPage = lazy(() => import('../pages/infra/operation'));
const TenantsPage = lazy(() => import('../pages/infra/tenants/list'));
const PackagesPage = lazy(() => import('../pages/infra/packages'));
const MonitoringPage = lazy(() => import('../pages/infra/monitoring'));
const PlatformAdminPage = lazy(() => import('../pages/infra/admin'));

/**
 * 页面布局包装函数
 *
 * 为系统和平台页面提供统一的BasicLayout包装
 * 公开页面（如登录页）不使用此包装
 */
const renderWithLayout = (PageComponent: React.ComponentType) => (
  <BasicLayout>
    <PageComponent />
  </BasicLayout>
);

/**
 * 系统核心路由组件
 *
 * 包含所有系统级和平台级功能路由，这些路由不依赖外部应用加载
 */
const SystemRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公开页面 */}
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/infra/login" element={<InfraLoginPage />} />
      <Route path="/lock-screen" element={<LockScreenPage />} />

      {/* 系统级路由 */}
      {/* 仪表盘重定向到工作台 */}
      <Route path="/system/dashboard" element={<Navigate to="/system/dashboard/workplace" replace />} />

      {/* 工作台页面 */}
      <Route path="/system/dashboard/workplace" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DashboardPage)}
        </Suspense>
      } />

      {/* 分析页面 */}
      <Route path="/system/dashboard/analysis" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DashboardAnalysisPage)}
        </Suspense>
      } />
      <Route path="/system/roles" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(RolesPage)}
        </Suspense>
      } />
      <Route path="/system/permissions" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PermissionsPage)}
        </Suspense>
      } />
      <Route path="/system/departments" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DepartmentsPage)}
        </Suspense>
      } />
      <Route path="/system/positions" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PositionsPage)}
        </Suspense>
      } />
      <Route path="/system/users" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(UserProfilePage)}
        </Suspense>
      } />
      <Route path="/system/user-profile" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(UserProfilePage)}
        </Suspense>
      } />
      <Route path="/system/languages" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(LanguagesPage)}
        </Suspense>
      } />
      <Route path="/system/site-settings" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(SiteSettingsPage)}
        </Suspense>
      } />
      <Route path="/system/applications" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(ApplicationCenterPage)}
        </Suspense>
      } />
      <Route path="/system/plugin-manager" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PluginManagerPage)}
        </Suspense>
      } />
      <Route path="/system/operation-logs" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(OperationLogsPage)}
        </Suspense>
      } />
      <Route path="/system/login-logs" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(LoginLogsPage)}
        </Suspense>
      } />
      <Route path="/system/online-users" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(OnlineUsersPage)}
        </Suspense>
      } />
      <Route path="/system/scheduled-tasks" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(ScheduledTasksPage)}
        </Suspense>
      } />
      <Route path="/system/scripts" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(ScriptsPage)}
        </Suspense>
      } />
      <Route path="/system/print-devices" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PrintDevicesPage)}
        </Suspense>
      } />
      <Route path="/system/print-templates" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PrintTemplatesPage)}
        </Suspense>
      } />
      <Route path="/system/code-rules" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(CodeRulesPage)}
        </Suspense>
      } />
      <Route path="/system/data-dictionaries" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DataDictionariesPage)}
        </Suspense>
      } />
      <Route path="/system/data-sources" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DataSourcesPage)}
        </Suspense>
      } />
      <Route path="/system/datasets" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DatasetsPage)}
        </Suspense>
      } />
      <Route path="/system/data-backups" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(DataBackupsPage)}
        </Suspense>
      } />
      <Route path="/system/custom-fields" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(CustomFieldsPage)}
        </Suspense>
      } />
      <Route path="/system/api-services" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(ApiServicesPage)}
        </Suspense>
      } />
      <Route path="/system/integration-configs" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(IntegrationConfigsPage)}
        </Suspense>
      } />
      <Route path="/system/message-templates" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(MessageTemplatesPage)}
        </Suspense>
      } />
      <Route path="/system/message-configs" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(MessageConfigsPage)}
        </Suspense>
      } />
      <Route path="/system/inngest" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(InngestDashboardPage)}
        </Suspense>
      } />

      {/* 平台级路由 */}
      <Route path="/infra/admin" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PlatformAdminPage)}
        </Suspense>
      } />
      <Route path="/infra/operation" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PlatformOperationPage)}
        </Suspense>
      } />
      <Route path="/platform/operation" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PlatformOperationPage)}
        </Suspense>
      } />
      <Route path="/infra/tenants" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(TenantsPage)}
        </Suspense>
      } />
      <Route path="/infra/packages" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(PackagesPage)}
        </Suspense>
      } />
      <Route path="/infra/monitoring" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(MonitoringPage)}
        </Suspense>
      } />
      <Route path="/infra/inngest" element={
        <Suspense fallback={<LoadingFallback />}>
          {renderWithLayout(InngestDashboardPage)}
        </Suspense>
      } />

      {/* 404 页面 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default SystemRoutes;
