/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 *
 * 性能优化：系统级/平台级页面按需懒加载，仅首屏核心页面立即加载
 *
 * ⚠️ 注意：BasicLayout 已提升到 MainRoutes 层级，这里不再包裹 BasicLayout
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../components/page-skeleton';

// 核心页面（立即加载，首屏必需）
import IndexPage from '../pages';
import LoginPage from '../pages/login';
import NotFoundPage from '../pages/404';
import InfraLoginPage from '../pages/infra/login';
import LockScreenPage from '../pages/lock-screen';
import InitWizardPage from '../pages/init/wizard';
import TemplateSelectPage from '../pages/init/template-select';
import QRCodeScanPage from '../pages/qrcode/scan';

// 懒加载包装（默认骨架屏）
const withSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}><LazyComponent /></Suspense>
);

// 工作台/分析页专用，骨架屏边距与 DashboardTemplate 一致
const withDashboardSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton variant="dashboard" />}><LazyComponent /></Suspense>
);

// 系统级页面（按需加载）
const DashboardPage = React.lazy(() => import('../pages/system/dashboard'));
const DashboardAnalysisPage = React.lazy(() => import('../pages/system/dashboard/analysis'));
const RolesPermissionsPage = React.lazy(() => import('../pages/system/roles-permissions'));
const PermissionsPage = React.lazy(() => import('../pages/system/permissions/list'));
const DepartmentsPage = React.lazy(() => import('../pages/system/departments/list'));
const PositionsPage = React.lazy(() => import('../pages/system/positions/list'));
const EquipmentPage = React.lazy(() => import('../pages/system/equipment/list'));
const EquipmentTracePage = React.lazy(() => import('../pages/system/equipment/trace'));
const MaintenancePlansPage = React.lazy(() => import('../pages/system/maintenance-plans/list'));
const EquipmentFaultsPage = React.lazy(() => import('../pages/system/equipment-faults/list'));
const MoldsPage = React.lazy(() => import('../pages/system/molds/list'));
const UsersPage = React.lazy(() => import('../pages/system/users/list'));
const UserProfilePage = React.lazy(() => import('../pages/personal/profile'));
const LanguagesPage = React.lazy(() => import('../pages/system/languages/list'));
const SiteSettingsPage = React.lazy(() => import('../pages/system/site-settings'));
const BusinessConfigPage = React.lazy(() => import('../pages/system/business-config'));
const ConfigCenterPage = React.lazy(() => import('../pages/system/config-center'));
const ApplicationCenterPage = React.lazy(() => import('../pages/system/applications/list'));
const PluginManagerPage = React.lazy(() => import('../pages/system/plugin-manager'));
const OperationLogsPage = React.lazy(() => import('../pages/system/operation-logs'));
const LoginLogsPage = React.lazy(() => import('../pages/system/login-logs'));
const OnlineUsersPage = React.lazy(() => import('../pages/system/online-users'));
const ScheduledTasksPage = React.lazy(() => import('../pages/system/scheduled-tasks/list'));
const ScriptsPage = React.lazy(() => import('../pages/system/scripts/list'));
const PrintDevicesPage = React.lazy(() => import('../pages/system/print-devices/list'));
const PrintTemplatesPage = React.lazy(() => import('../pages/system/print-templates/list'));
const CodeRulesPage = React.lazy(() => import('../pages/system/code-rules/list'));
const DataDictionariesPage = React.lazy(() => import('../pages/system/data-dictionaries/list'));
const DataSourcesPage = React.lazy(() => import('../pages/system/data-sources/list'));
const ApplicationConnectionsPage = React.lazy(() => import('../pages/system/application-connections/list'));
const DatasetsPage = React.lazy(() => import('../pages/system/datasets/list'));
const DatasetDesignerPage = React.lazy(() => import('../pages/system/datasets/designer'));
const DataBackupsPage = React.lazy(() => import('../pages/system/data-backups'));
const CustomFieldsPage = React.lazy(() => import('../pages/system/custom-fields/list'));
const ApiServicesPage = React.lazy(() => import('../pages/system/apis/list'));
const IntegrationConfigsPage = React.lazy(() => import('../pages/system/integration-configs/list'));
const MessageTemplatesPage = React.lazy(() => import('../pages/system/messages/template'));
const MessageConfigsPage = React.lazy(() => import('../pages/system/messages/config'));
const MenusPage = React.lazy(() => import('../pages/system/menus'));
const SystemParametersPage = React.lazy(() => import('../pages/system/system-parameters'));
const FilesPage = React.lazy(() => import('../pages/system/files/list'));
const ApprovalProcessesPage = React.lazy(() => import('../pages/system/approval-processes/list'));
const ApprovalProcessDesignerPage = React.lazy(() => import('../pages/system/approval-processes/designer'));
const ApprovalInstancesPage = React.lazy(() => import('../pages/system/approval-processes/instances'));
const ReportTemplatesPage = React.lazy(() => import('../pages/system/report-templates'));
const ReportDesignPage = React.lazy(() => import('../pages/system/report-templates/design'));
const PrintTemplateDesignPage = React.lazy(() => import('../pages/system/print-templates/design'));
const RoleScenariosPage = React.lazy(() => import('../pages/system/role-scenarios'));
const OnboardingWizardPage = React.lazy(() => import('../pages/system/onboarding-wizard'));
const DataQualityPage = React.lazy(() => import('../pages/system/data-quality'));
const OperationGuidePage = React.lazy(() => import('../pages/system/operation-guide'));
const LaunchProgressPage = React.lazy(() => import('../pages/system/launch-progress'));
const UsageAnalysisPage = React.lazy(() => import('../pages/system/usage-analysis'));
const PersonalProfilePage = React.lazy(() => import('../pages/personal/profile'));
const PersonalPreferencesPage = React.lazy(() => import('../pages/personal/preferences'));
const PersonalMessagesPage = React.lazy(() => import('../pages/personal/messages'));
const PersonalTasksPage = React.lazy(() => import('../pages/personal/tasks'));
const InngestDashboardPage = React.lazy(() => import('../pages/infra/inngest'));

// 平台级页面（按需加载）
const PlatformOperationPage = React.lazy(() => import('../pages/infra/operation'));
const TenantsPage = React.lazy(() => import('../pages/infra/tenants/list'));
const PackagesPage = React.lazy(() => import('../pages/infra/packages'));
const MonitoringPage = React.lazy(() => import('../pages/infra/monitoring'));
const PlatformAdminPage = React.lazy(() => import('../pages/infra/admin'));

const SystemRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<IndexPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/infra/login" element={<InfraLoginPage />} />
    <Route path="/lock-screen" element={<LockScreenPage />} />
    <Route path="/init/wizard" element={<InitWizardPage />} />
    <Route path="/init/template-select" element={<TemplateSelectPage />} />
    <Route path="/qrcode/scan" element={<QRCodeScanPage />} />

    <Route path="/system/dashboard" element={<Navigate to="/system/dashboard/workplace" replace />} />
    <Route path="/system/dashboard/workplace" element={withDashboardSuspense(DashboardPage)} />
    <Route path="/system/dashboard/analysis" element={withDashboardSuspense(DashboardAnalysisPage)} />
    <Route path="/system/roles" element={withSuspense(RolesPermissionsPage)} />
    <Route path="/system/permissions" element={withSuspense(PermissionsPage)} />
    <Route path="/system/departments" element={withSuspense(DepartmentsPage)} />
    <Route path="/system/positions" element={withSuspense(PositionsPage)} />
    <Route path="/system/equipment" element={withSuspense(EquipmentPage)} />
    <Route path="/system/equipment/:uuid/trace" element={withSuspense(EquipmentTracePage)} />
    <Route path="/system/maintenance-plans" element={withSuspense(MaintenancePlansPage)} />
    <Route path="/system/equipment-faults" element={withSuspense(EquipmentFaultsPage)} />
    <Route path="/system/molds" element={withSuspense(MoldsPage)} />
    <Route path="/system/users" element={withSuspense(UsersPage)} />
    <Route path="/system/user-profile" element={withSuspense(UserProfilePage)} />
    <Route path="/system/languages" element={withSuspense(LanguagesPage)} />
    <Route path="/system/site-settings" element={withSuspense(SiteSettingsPage)} />
    <Route path="/system/config-center" element={withSuspense(ConfigCenterPage)} />
    <Route path="/system/system-parameters" element={<Navigate to="/system/config-center" replace />} />
    <Route path="/system/business-config" element={<Navigate to="/system/config-center?tab=graph" replace />} />
    <Route path="/system/applications" element={withSuspense(ApplicationCenterPage)} />
    <Route path="/system/plugin-manager" element={withSuspense(PluginManagerPage)} />
    <Route path="/system/operation-logs" element={withSuspense(OperationLogsPage)} />
    <Route path="/system/login-logs" element={withSuspense(LoginLogsPage)} />
    <Route path="/system/online-users" element={withSuspense(OnlineUsersPage)} />
    <Route path="/system/scheduled-tasks" element={withSuspense(ScheduledTasksPage)} />
    <Route path="/system/scripts" element={withSuspense(ScriptsPage)} />
    <Route path="/system/print-devices" element={withSuspense(PrintDevicesPage)} />
    <Route path="/system/print-templates" element={withSuspense(PrintTemplatesPage)} />
    <Route path="/system/print-templates/design/:uuid" element={withSuspense(PrintTemplateDesignPage)} />
    <Route path="/system/code-rules" element={withSuspense(CodeRulesPage)} />
    <Route path="/system/data-dictionaries" element={withSuspense(DataDictionariesPage)} />
    <Route path="/system/data-sources" element={withSuspense(DataSourcesPage)} />
    <Route path="/system/application-connections" element={withSuspense(ApplicationConnectionsPage)} />
    <Route path="/system/datasets" element={withSuspense(DatasetsPage)} />
    <Route path="/system/datasets/designer" element={withSuspense(DatasetDesignerPage)} />
    <Route path="/system/data-backups" element={withSuspense(DataBackupsPage)} />
    <Route path="/system/custom-fields" element={withSuspense(CustomFieldsPage)} />
    <Route path="/system/api-services" element={withSuspense(ApiServicesPage)} />
    <Route path="/system/apis" element={withSuspense(ApiServicesPage)} />
    <Route path="/system/integration-configs" element={withSuspense(IntegrationConfigsPage)} />
    <Route path="/system/message-templates" element={withSuspense(MessageTemplatesPage)} />
    <Route path="/system/messages/template" element={withSuspense(MessageTemplatesPage)} />
    <Route path="/system/message-configs" element={withSuspense(MessageConfigsPage)} />
    <Route path="/system/messages/config" element={withSuspense(MessageConfigsPage)} />
    <Route path="/system/menus" element={withSuspense(MenusPage)} />
    <Route path="/system/system-parameters" element={withSuspense(SystemParametersPage)} />
    <Route path="/system/files" element={withSuspense(FilesPage)} />
    <Route path="/system/approval-processes" element={withSuspense(ApprovalProcessesPage)} />
    <Route path="/system/approval-processes/designer" element={withSuspense(ApprovalProcessDesignerPage)} />
    <Route path="/system/approval-instances" element={withSuspense(ApprovalInstancesPage)} />
    <Route path="/system/report-templates" element={withSuspense(ReportTemplatesPage)} />
    <Route path="/system/report-templates/:id/design" element={withSuspense(ReportDesignPage)} />
    <Route path="/system/role-scenarios" element={withSuspense(RoleScenariosPage)} />
    <Route path="/system/onboarding-wizard" element={withSuspense(OnboardingWizardPage)} />
    <Route path="/system/data-quality" element={withSuspense(DataQualityPage)} />
    <Route path="/system/operation-guide" element={withSuspense(OperationGuidePage)} />
    <Route path="/system/launch-progress" element={withSuspense(LaunchProgressPage)} />
    <Route path="/system/usage-analysis" element={withSuspense(UsageAnalysisPage)} />
    <Route path="/system/inngest" element={withSuspense(InngestDashboardPage)} />

    <Route path="/personal/profile" element={withSuspense(PersonalProfilePage)} />
    <Route path="/personal/preferences" element={withSuspense(PersonalPreferencesPage)} />
    <Route path="/personal/messages" element={withSuspense(PersonalMessagesPage)} />
    <Route path="/personal/tasks" element={withSuspense(PersonalTasksPage)} />

    <Route path="/infra/admin" element={withSuspense(PlatformAdminPage)} />
    <Route path="/infra/operation" element={withSuspense(PlatformOperationPage)} />
    <Route path="/platform/operation" element={withSuspense(PlatformOperationPage)} />
    <Route path="/infra/tenants" element={withSuspense(TenantsPage)} />
    <Route path="/infra/packages" element={withSuspense(PackagesPage)} />
    <Route path="/infra/monitoring" element={withSuspense(MonitoringPage)} />
    <Route path="/infra/inngest" element={withSuspense(InngestDashboardPage)} />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default SystemRoutes;
