/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

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
const InvitationCodesPage = lazy(() => import('../pages/system/invitation-codes/list'));
const MessageTemplatesPage = lazy(() => import('../pages/system/messages/template'));
const MessageConfigsPage = lazy(() => import('../pages/system/messages/config'));

// 平台级页面（懒加载）
const PlatformOperationPage = lazy(() => import('../pages/infra/operation'));
const TenantsPage = lazy(() => import('../pages/infra/tenants/list'));
const PackagesPage = lazy(() => import('../pages/infra/packages'));
const MonitoringPage = lazy(() => import('../pages/infra/monitoring'));

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
      <Route path="/system/dashboard" element={
        <Suspense fallback={<LoadingFallback />}>
          <DashboardPage />
        </Suspense>
      } />
      <Route path="/system/roles" element={
        <Suspense fallback={<LoadingFallback />}>
          <RolesPage />
        </Suspense>
      } />
      <Route path="/system/permissions" element={
        <Suspense fallback={<LoadingFallback />}>
          <PermissionsPage />
        </Suspense>
      } />
      <Route path="/system/departments" element={
        <Suspense fallback={<LoadingFallback />}>
          <DepartmentsPage />
        </Suspense>
      } />
      <Route path="/system/positions" element={
        <Suspense fallback={<LoadingFallback />}>
          <PositionsPage />
        </Suspense>
      } />
      <Route path="/system/users" element={
        <Suspense fallback={<LoadingFallback />}>
          <UserProfilePage />
        </Suspense>
      } />
      <Route path="/system/user-profile" element={
        <Suspense fallback={<LoadingFallback />}>
          <UserProfilePage />
        </Suspense>
      } />
      <Route path="/system/languages" element={
        <Suspense fallback={<LoadingFallback />}>
          <LanguagesPage />
        </Suspense>
      } />
      <Route path="/system/site-settings" element={
        <Suspense fallback={<LoadingFallback />}>
          <SiteSettingsPage />
        </Suspense>
      } />
      <Route path="/system/applications" element={
        <Suspense fallback={<LoadingFallback />}>
          <ApplicationCenterPage />
        </Suspense>
      } />
      <Route path="/system/applications/:uuid" element={
        <Suspense fallback={<LoadingFallback />}>
          <ApplicationDetailPage />
        </Suspense>
      } />
      <Route path="/system/plugin-manager" element={
        <Suspense fallback={<LoadingFallback />}>
          <PluginManagerPage />
        </Suspense>
      } />
      <Route path="/system/operation-logs" element={
        <Suspense fallback={<LoadingFallback />}>
          <OperationLogsPage />
        </Suspense>
      } />
      <Route path="/system/login-logs" element={
        <Suspense fallback={<LoadingFallback />}>
          <LoginLogsPage />
        </Suspense>
      } />
      <Route path="/system/online-users" element={
        <Suspense fallback={<LoadingFallback />}>
          <OnlineUsersPage />
        </Suspense>
      } />
      <Route path="/system/scheduled-tasks" element={
        <Suspense fallback={<LoadingFallback />}>
          <ScheduledTasksPage />
        </Suspense>
      } />
      <Route path="/system/scripts" element={
        <Suspense fallback={<LoadingFallback />}>
          <ScriptsPage />
        </Suspense>
      } />
      <Route path="/system/print-devices" element={
        <Suspense fallback={<LoadingFallback />}>
          <PrintDevicesPage />
        </Suspense>
      } />
      <Route path="/system/print-templates" element={
        <Suspense fallback={<LoadingFallback />}>
          <PrintTemplatesPage />
        </Suspense>
      } />
      <Route path="/system/code-rules" element={
        <Suspense fallback={<LoadingFallback />}>
          <CodeRulesPage />
        </Suspense>
      } />
      <Route path="/system/data-dictionaries" element={
        <Suspense fallback={<LoadingFallback />}>
          <DataDictionariesPage />
        </Suspense>
      } />
      <Route path="/system/data-sources" element={
        <Suspense fallback={<LoadingFallback />}>
          <DataSourcesPage />
        </Suspense>
      } />
      <Route path="/system/datasets" element={
        <Suspense fallback={<LoadingFallback />}>
          <DatasetsPage />
        </Suspense>
      } />
      <Route path="/system/data-backups" element={
        <Suspense fallback={<LoadingFallback />}>
          <DataBackupsPage />
        </Suspense>
      } />
      <Route path="/system/custom-fields" element={
        <Suspense fallback={<LoadingFallback />}>
          <CustomFieldsPage />
        </Suspense>
      } />
      <Route path="/system/api-services" element={
        <Suspense fallback={<LoadingFallback />}>
          <ApiServicesPage />
        </Suspense>
      } />
      <Route path="/system/integration-configs" element={
        <Suspense fallback={<LoadingFallback />}>
          <IntegrationConfigsPage />
        </Suspense>
      } />
      <Route path="/system/invitation-codes" element={
        <Suspense fallback={<LoadingFallback />}>
          <InvitationCodesPage />
        </Suspense>
      } />
      <Route path="/system/message-templates" element={
        <Suspense fallback={<LoadingFallback />}>
          <MessageTemplatesPage />
        </Suspense>
      } />
      <Route path="/system/message-configs" element={
        <Suspense fallback={<LoadingFallback />}>
          <MessageConfigsPage />
        </Suspense>
      } />

      {/* 平台级路由 */}
      <Route path="/platform/operation" element={
        <Suspense fallback={<LoadingFallback />}>
          <PlatformOperationPage />
        </Suspense>
      } />
      <Route path="/infra/tenants" element={
        <Suspense fallback={<LoadingFallback />}>
          <TenantsPage />
        </Suspense>
      } />
      <Route path="/infra/packages" element={
        <Suspense fallback={<LoadingFallback />}>
          <PackagesPage />
        </Suspense>
      } />
      <Route path="/infra/monitoring" element={
        <Suspense fallback={<LoadingFallback />}>
          <MonitoringPage />
        </Suspense>
      } />

      {/* 404 页面 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default SystemRoutes;
