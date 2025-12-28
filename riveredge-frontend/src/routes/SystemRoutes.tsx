/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BasicLayout from '../layouts/BasicLayout';

// 核心系统页面（立即加载）
import IndexPage from '../pages';
import LoginPage from '../pages/login';
import NotFoundPage from '../pages/404';
import InfraLoginPage from '../pages/infra/login';
import LockScreenPage from '../pages/lock-screen';

// 系统级页面（直接导入，移除懒加载）
import DashboardPage from '../pages/system/dashboard';

import DashboardAnalysisPage from '../pages/system/dashboard/analysis';
import RolesPage from '../pages/system/roles/list';
import PermissionsPage from '../pages/system/permissions/list';
import DepartmentsPage from '../pages/system/departments/list';
import PositionsPage from '../pages/system/positions/list';
import UsersPage from '../pages/system/users/list';
import UserProfilePage from '../pages/personal/profile';
import LanguagesPage from '../pages/system/languages/list';
import SiteSettingsPage from '../pages/system/site-settings';
import ApplicationCenterPage from '../pages/system/applications/list';
import PluginManagerPage from '../pages/system/plugin-manager';
import OperationLogsPage from '../pages/system/operation-logs';
import LoginLogsPage from '../pages/system/login-logs';
import OnlineUsersPage from '../pages/system/online-users';
import ScheduledTasksPage from '../pages/system/scheduled-tasks/list';
import ScriptsPage from '../pages/system/scripts/list';
import PrintDevicesPage from '../pages/system/print-devices/list';
import PrintTemplatesPage from '../pages/system/print-templates/list';
import CodeRulesPage from '../pages/system/code-rules/list';
import DataDictionariesPage from '../pages/system/data-dictionaries/list';
import DataSourcesPage from '../pages/system/data-sources/list';
import DatasetsPage from '../pages/system/datasets/list';
import DataBackupsPage from '../pages/system/data-backups';
import CustomFieldsPage from '../pages/system/custom-fields/list';
import ApiServicesPage from '../pages/system/apis/list';
import ApisPage from '../pages/system/apis/list'; // 别名，用于 /system/apis 路由
import IntegrationConfigsPage from '../pages/system/integration-configs/list';
import MessageTemplatesPage from '../pages/system/messages/template';
import MessageConfigsPage from '../pages/system/messages/config';
import MenusPage from '../pages/system/menus';
import SystemParametersPage from '../pages/system/system-parameters/list';
import FilesPage from '../pages/system/files/list';
import ApprovalProcessesPage from '../pages/system/approval-processes/list';
import ApprovalInstancesPage from '../pages/system/approval-processes/instances';
import PersonalProfilePage from '../pages/personal/profile';
import PersonalPreferencesPage from '../pages/personal/preferences';
import PersonalMessagesPage from '../pages/personal/messages';
import PersonalTasksPage from '../pages/personal/tasks';
import InngestDashboardPage from '../pages/infra/inngest';

// 平台级页面（直接导入，移除懒加载）
import PlatformOperationPage from '../pages/infra/operation';
import TenantsPage from '../pages/infra/tenants/list';
import PackagesPage from '../pages/infra/packages';
import MonitoringPage from '../pages/infra/monitoring';
import PlatformAdminPage from '../pages/infra/admin';

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
      <Route path="/system/dashboard/workplace" element={renderWithLayout(DashboardPage)} />

      {/* 分析页面 */}
      <Route path="/system/dashboard/analysis" element={renderWithLayout(DashboardAnalysisPage)} />
      <Route path="/system/roles" element={renderWithLayout(RolesPage)} />
      <Route path="/system/permissions" element={renderWithLayout(PermissionsPage)} />
      <Route path="/system/departments" element={renderWithLayout(DepartmentsPage)} />
      <Route path="/system/positions" element={renderWithLayout(PositionsPage)} />
      <Route path="/system/users" element={renderWithLayout(UsersPage)} />
      <Route path="/system/user-profile" element={renderWithLayout(UserProfilePage)} />
      <Route path="/system/languages" element={renderWithLayout(LanguagesPage)} />
      <Route path="/system/site-settings" element={renderWithLayout(SiteSettingsPage)} />
      <Route path="/system/applications" element={renderWithLayout(ApplicationCenterPage)} />
      <Route path="/system/plugin-manager" element={renderWithLayout(PluginManagerPage)} />
      <Route path="/system/operation-logs" element={renderWithLayout(OperationLogsPage)} />
      <Route path="/system/login-logs" element={renderWithLayout(LoginLogsPage)} />
      <Route path="/system/online-users" element={renderWithLayout(OnlineUsersPage)} />
      <Route path="/system/scheduled-tasks" element={renderWithLayout(ScheduledTasksPage)} />
      <Route path="/system/scripts" element={renderWithLayout(ScriptsPage)} />
      <Route path="/system/print-devices" element={renderWithLayout(PrintDevicesPage)} />
      <Route path="/system/print-templates" element={renderWithLayout(PrintTemplatesPage)} />
      <Route path="/system/code-rules" element={renderWithLayout(CodeRulesPage)} />
      <Route path="/system/data-dictionaries" element={renderWithLayout(DataDictionariesPage)} />
      <Route path="/system/data-sources" element={renderWithLayout(DataSourcesPage)} />
      <Route path="/system/datasets" element={renderWithLayout(DatasetsPage)} />
      <Route path="/system/data-backups" element={renderWithLayout(DataBackupsPage)} />
      <Route path="/system/custom-fields" element={renderWithLayout(CustomFieldsPage)} />
      <Route path="/system/api-services" element={renderWithLayout(ApiServicesPage)} />
      <Route path="/system/apis" element={renderWithLayout(ApisPage)} />
      <Route path="/system/integration-configs" element={renderWithLayout(IntegrationConfigsPage)} />
      <Route path="/system/message-templates" element={renderWithLayout(MessageTemplatesPage)} />
      <Route path="/system/messages/template" element={renderWithLayout(MessageTemplatesPage)} />
      <Route path="/system/message-configs" element={renderWithLayout(MessageConfigsPage)} />
      <Route path="/system/messages/config" element={renderWithLayout(MessageConfigsPage)} />
      <Route path="/system/menus" element={renderWithLayout(MenusPage)} />
      <Route path="/system/system-parameters" element={renderWithLayout(SystemParametersPage)} />
      <Route path="/system/files" element={renderWithLayout(FilesPage)} />
      <Route path="/system/approval-processes" element={renderWithLayout(ApprovalProcessesPage)} />
      <Route path="/system/approval-instances" element={renderWithLayout(ApprovalInstancesPage)} />
      <Route path="/system/inngest" element={renderWithLayout(InngestDashboardPage)} />

      {/* 个人相关路由 */}
      <Route path="/personal/profile" element={renderWithLayout(PersonalProfilePage)} />
      <Route path="/personal/preferences" element={renderWithLayout(PersonalPreferencesPage)} />
      <Route path="/personal/messages" element={renderWithLayout(PersonalMessagesPage)} />
      <Route path="/personal/tasks" element={renderWithLayout(PersonalTasksPage)} />

      {/* 调试路由 */}

      {/* 平台级路由 */}
      <Route path="/infra/admin" element={renderWithLayout(PlatformAdminPage)} />
      <Route path="/infra/operation" element={renderWithLayout(PlatformOperationPage)} />
      <Route path="/platform/operation" element={renderWithLayout(PlatformOperationPage)} />
      <Route path="/infra/tenants" element={renderWithLayout(TenantsPage)} />
      <Route path="/infra/packages" element={renderWithLayout(PackagesPage)} />
      <Route path="/infra/monitoring" element={renderWithLayout(MonitoringPage)} />
      <Route path="/infra/inngest" element={renderWithLayout(InngestDashboardPage)} />

      {/* 404 页面 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default SystemRoutes;
