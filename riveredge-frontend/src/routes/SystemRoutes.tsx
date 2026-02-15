/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 * 
 * ⚠️ 注意：BasicLayout 已提升到 MainRoutes 层级，这里不再包裹 BasicLayout
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 核心系统页面（立即加载）
import IndexPage from '../pages';
import LoginPage from '../pages/login';
import NotFoundPage from '../pages/404';
import InfraLoginPage from '../pages/infra/login';
import LockScreenPage from '../pages/lock-screen';
import InitWizardPage from '../pages/init/wizard';
import TemplateSelectPage from '../pages/init/template-select';
import QRCodeScanPage from '../pages/qrcode/scan';

// 系统级页面（直接导入，移除懒加载）
import DashboardPage from '../pages/system/dashboard';

import DashboardAnalysisPage from '../pages/system/dashboard/analysis';
import RolesPage from '../pages/system/roles/list';
import PermissionsPage from '../pages/system/permissions/list';
import DepartmentsPage from '../pages/system/departments/list';
import PositionsPage from '../pages/system/positions/list';
import EquipmentPage from '../pages/system/equipment/list';
import EquipmentTracePage from '../pages/system/equipment/trace';
import MaintenancePlansPage from '../pages/system/maintenance-plans/list';
import EquipmentFaultsPage from '../pages/system/equipment-faults/list';
import MoldsPage from '../pages/system/molds/list';
import UsersPage from '../pages/system/users/list';
import UserProfilePage from '../pages/personal/profile';
import LanguagesPage from '../pages/system/languages/list';
import SiteSettingsPage from '../pages/system/site-settings';
import BusinessConfigPage from '../pages/system/business-config';
import ConfigCenterPage from '../pages/system/config-center';
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
import SystemParametersPage from '../pages/system/system-parameters';
import FilesPage from '../pages/system/files/list';
import ApprovalProcessesPage from '../pages/system/approval-processes/list';
import ApprovalProcessDesignerPage from '../pages/system/approval-processes/designer';
import ApprovalInstancesPage from '../pages/system/approval-processes/instances';
import ReportTemplatesPage from '../pages/system/report-templates';
import ReportDesignPage from '../pages/system/report-templates/design';
import RoleScenariosPage from '../pages/system/role-scenarios';
import OnboardingWizardPage from '../pages/system/onboarding-wizard';
import DataQualityPage from '../pages/system/data-quality';
import OperationGuidePage from '../pages/system/operation-guide';
import LaunchProgressPage from '../pages/system/launch-progress';
import UsageAnalysisPage from '../pages/system/usage-analysis';
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
 * 系统核心路由组件
 *
 * 包含所有系统级和平台级功能路由，这些路由不依赖外部应用加载
 * 
 * ⚠️ 注意：BasicLayout 已提升到 MainRoutes 层级，这里直接返回页面组件
 */
const SystemRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公开页面（不需要 BasicLayout，在 MainRoutes 中已处理） */}
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/infra/login" element={<InfraLoginPage />} />
      <Route path="/lock-screen" element={<LockScreenPage />} />

      {/* 初始化向导页面（不需要布局） */}
      <Route path="/init/wizard" element={<InitWizardPage />} />
      <Route path="/init/template-select" element={<TemplateSelectPage />} />

      {/* 二维码扫描页面（不需要布局） */}
      <Route path="/qrcode/scan" element={<QRCodeScanPage />} />

      {/* 系统级路由（需要 BasicLayout，在 MainRoutes 中已包裹） */}
      {/* 仪表盘重定向到工作台 */}
      <Route path="/system/dashboard" element={<Navigate to="/system/dashboard/workplace" replace />} />

      {/* 工作台页面 */}
      <Route path="/system/dashboard/workplace" element={<DashboardPage />} />

      {/* 分析页面 */}
      <Route path="/system/dashboard/analysis" element={<DashboardAnalysisPage />} />
      <Route path="/system/roles" element={<RolesPage />} />
      <Route path="/system/permissions" element={<PermissionsPage />} />
      <Route path="/system/departments" element={<DepartmentsPage />} />
      <Route path="/system/positions" element={<PositionsPage />} />
      <Route path="/system/equipment" element={<EquipmentPage />} />
      <Route path="/system/equipment/:uuid/trace" element={<EquipmentTracePage />} />
      <Route path="/system/maintenance-plans" element={<MaintenancePlansPage />} />
      <Route path="/system/equipment-faults" element={<EquipmentFaultsPage />} />
      <Route path="/system/molds" element={<MoldsPage />} />
      <Route path="/system/users" element={<UsersPage />} />
      <Route path="/system/user-profile" element={<UserProfilePage />} />
      <Route path="/system/languages" element={<LanguagesPage />} />
      <Route path="/system/site-settings" element={<SiteSettingsPage />} />
      <Route path="/system/config-center" element={<ConfigCenterPage />} />
      <Route path="/system/system-parameters" element={<Navigate to="/system/config-center" replace />} />
      <Route path="/system/business-config" element={<Navigate to="/system/config-center?tab=graph" replace />} />
      <Route path="/system/applications" element={<ApplicationCenterPage />} />
      <Route path="/system/plugin-manager" element={<PluginManagerPage />} />
      <Route path="/system/operation-logs" element={<OperationLogsPage />} />
      <Route path="/system/login-logs" element={<LoginLogsPage />} />
      <Route path="/system/online-users" element={<OnlineUsersPage />} />
      <Route path="/system/scheduled-tasks" element={<ScheduledTasksPage />} />
      <Route path="/system/scripts" element={<ScriptsPage />} />
      <Route path="/system/print-devices" element={<PrintDevicesPage />} />
      <Route path="/system/print-templates" element={<PrintTemplatesPage />} />
      <Route path="/system/code-rules" element={<CodeRulesPage />} />
      <Route path="/system/data-dictionaries" element={<DataDictionariesPage />} />
      <Route path="/system/data-sources" element={<DataSourcesPage />} />
      <Route path="/system/datasets" element={<DatasetsPage />} />
      <Route path="/system/data-backups" element={<DataBackupsPage />} />
      <Route path="/system/custom-fields" element={<CustomFieldsPage />} />
      <Route path="/system/api-services" element={<ApiServicesPage />} />
      <Route path="/system/apis" element={<ApisPage />} />
      <Route path="/system/integration-configs" element={<IntegrationConfigsPage />} />
      <Route path="/system/message-templates" element={<MessageTemplatesPage />} />
      <Route path="/system/messages/template" element={<MessageTemplatesPage />} />
      <Route path="/system/message-configs" element={<MessageConfigsPage />} />
      <Route path="/system/messages/config" element={<MessageConfigsPage />} />
      <Route path="/system/menus" element={<MenusPage />} />
      <Route path="/system/system-parameters" element={<SystemParametersPage />} />
      <Route path="/system/files" element={<FilesPage />} />
      <Route path="/system/approval-processes" element={<ApprovalProcessesPage />} />
      <Route path="/system/approval-processes/designer" element={<ApprovalProcessDesignerPage />} />
      <Route path="/system/approval-instances" element={<ApprovalInstancesPage />} />
      <Route path="/system/report-templates" element={<ReportTemplatesPage />} />
      <Route path="/system/report-templates/:id/design" element={<ReportDesignPage />} />
      <Route path="/system/role-scenarios" element={<RoleScenariosPage />} />
      <Route path="/system/onboarding-wizard" element={<OnboardingWizardPage />} />
      <Route path="/system/data-quality" element={<DataQualityPage />} />
      <Route path="/system/operation-guide" element={<OperationGuidePage />} />
      <Route path="/system/launch-progress" element={<LaunchProgressPage />} />
      <Route path="/system/usage-analysis" element={<UsageAnalysisPage />} />
      <Route path="/system/inngest" element={<InngestDashboardPage />} />

      {/* 个人相关路由 */}
      <Route path="/personal/profile" element={<PersonalProfilePage />} />
      <Route path="/personal/preferences" element={<PersonalPreferencesPage />} />
      <Route path="/personal/messages" element={<PersonalMessagesPage />} />
      <Route path="/personal/tasks" element={<PersonalTasksPage />} />

      {/* 调试路由 */}

      {/* 平台级路由 */}
      <Route path="/infra/admin" element={<PlatformAdminPage />} />
      <Route path="/infra/operation" element={<PlatformOperationPage />} />
      <Route path="/platform/operation" element={<PlatformOperationPage />} />
      <Route path="/infra/tenants" element={<TenantsPage />} />
      <Route path="/infra/packages" element={<PackagesPage />} />
      <Route path="/infra/monitoring" element={<MonitoringPage />} />
      <Route path="/infra/inngest" element={<InngestDashboardPage />} />

      {/* 404 页面（不需要 BasicLayout） */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default SystemRoutes;
