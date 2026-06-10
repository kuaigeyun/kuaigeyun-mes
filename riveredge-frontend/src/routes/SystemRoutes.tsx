/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 *
 * 性能优化：系统级/平台级页面按需懒加载，仅首屏核心页面立即加载
 *
 * 约定：URL 路径与渲染组件所在目录一致，避免歧义（如 /system/config-center 对应 config-center 页面）。
 * 旧路径通过 Navigate 重定向到主路径，统一到单一路径入口。
 *
 * ⚠️ 注意：BasicLayout 已提升到 MainRoutes 层级，这里不再包裹 BasicLayout
 */

import React, { Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import PageSkeleton, { PageSkeletonProps } from '../components/page-skeleton';
import { useGlobalStore } from '../stores/globalStore';
import { hasAnyPermission } from '../utils/permission';
import { useRedirectIfSystemDashboardOff } from '../hooks/useRedirectIfSystemDashboardOff';

// 核心页面（立即加载，首屏必需）
import IndexPage from '../pages';
import NotFoundPage from '../pages/404';

// 登录页懒加载（按需加载以减小主包）。Suspense fallback 不用骨架屏：与独立 login.html 入口一致，chunk 就绪前留白即可。
// 独立 MPA：开发服 Vite 将 /login 指向 login.html；生产多为 index.html + 本路由懒加载。
const LoginPage = React.lazy(() => import('../pages/login'));
// 公开页面按需懒加载，减小主包体积，加快登录首屏
const InfraLoginPage = React.lazy(() => import('../pages/infra/login'));
const LockScreenPage = React.lazy(() => import('../pages/lock-screen'));
const InitWizardPage = React.lazy(() => import('../pages/init/wizard'));
const TemplateSelectPage = React.lazy(() => import('../pages/init/template-select'));
const QRCodeScanPage = React.lazy(() => import('../pages/qrcode/scan'));
const DocsPage = React.lazy(() => import('../pages/docs'));

/**
 * 延迟显示的 Fallback 组件
 * 初始 delayMs 内渲染 null，超时后才显示 Spin，避免快速加载时的闪烁
 */
const DelayedFallback: React.FC<{ variant?: PageSkeletonProps['variant']; delayMs?: number }> = ({
  variant = 'content',
  delayMs = 150,
}) => {
  const [show, setShow] = React.useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
  return show ? <PageSkeleton variant={variant} /> : null;
};

// 懒加载包装：主内容区统一 Spin（DelayedFallback）
const withSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback />}><LazyComponent /></Suspense>
);

const withLoginSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={null}><LazyComponent /></Suspense>
);

const withDashboardSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback />}><LazyComponent /></Suspense>
);

const withPermission = (
  element: React.ReactElement,
  permissionCodes?: string[],
) => {
  if (!permissionCodes || permissionCodes.length === 0) {
    return element;
  }
  return <RoutePermissionGuard permissionCodes={permissionCodes}>{element}</RoutePermissionGuard>;
};

/** 系统级仪表盘关闭时拦截工作台 / 运营看板路由 */
const SystemDashboardRouteGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { initialized, enabled } = useRedirectIfSystemDashboardOff();
  if (!initialized) {
    return <PageSkeleton />;
  }
  if (!enabled) return null;
  return <>{children}</>;
};

const RoutePermissionGuard: React.FC<{ permissionCodes: string[]; children: React.ReactNode }> = ({
  permissionCodes,
  children,
}) => {
  const { t } = useTranslation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const denied = !hasAnyPermission(currentUser, permissionCodes);
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (denied && !notifiedRef.current) {
      notifiedRef.current = true;
      Modal.warning({
        title: t('common.permissionDenied'),
        content: t('common.permissionDeniedDetail', { permissions: permissionCodes.join(' / ') }),
      });
    }
  }, [denied, permissionCodes, t]);
  if (denied) {
    return <PageSkeleton />;
  }
  return <>{children}</>;
};

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
const ConfigCenterPage = React.lazy(() => import('../pages/system/config-center'));
const ApplicationCenterPage = React.lazy(() => import('../pages/system/applications/list'));
const DefaultHomePage = React.lazy(() => import('../pages/system/default-home'));
const PluginManagerPage = React.lazy(() => import('../pages/system/plugin-manager'));
const OperationLogsPage = React.lazy(() => import('../pages/system/operation-logs'));
const LoginLogsPage = React.lazy(() => import('../pages/system/login-logs'));
const OnlineUsersPage = React.lazy(() => import('../pages/system/online-users'));
const ScheduledTasksPage = React.lazy(() => import('../pages/infra/scheduled-tasks/list'));
const ScriptsPage = React.lazy(() => import('../pages/infra/scripts/list'));
const PrintDevicesPage = React.lazy(() => import('../pages/system/print-devices/list'));
const PrintTemplatesPage = React.lazy(() => import('../pages/system/print-templates/list'));
const CodeRulesPage = React.lazy(() => import('../pages/system/code-rules/list'));
const DataDictionariesPage = React.lazy(() => import('../pages/system/data-dictionaries/list'));
const DataSourcesPage = React.lazy(() => import('../pages/system/data-sources/list'));
const ApplicationConnectionsPage = React.lazy(() => import('../pages/system/application-connections/list'));
const DatasetsPage = React.lazy(() => import('../pages/system/datasets/list'));
const DatasetDesignerPage = React.lazy(() => import('../pages/system/datasets/designer'));
/** 期初数据导入：业务页面仍在快智造模块，系统级入口挂载于此路径 */
const InitialDataImportPage = React.lazy(() => import('../apps/kuaizhizao/pages/warehouse-management/initial-data'));

const DataBackupsPage = React.lazy(() => import('../pages/system/data-backups'));
const CustomFieldsPage = React.lazy(() => import('../pages/system/custom-fields/list'));
const ApiServicesPage = React.lazy(() => import('../pages/system/apis/list'));
const IntegrationConfigsPage = React.lazy(() => import('../pages/system/integration-configs/list'));
const MessageTemplatesPage = React.lazy(() => import('../pages/system/messages/template'));
const MessageConfigsPage = React.lazy(() => import('../pages/system/messages/config'));
const MenusPage = React.lazy(() => import('../pages/system/menus'));
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

// 平台级页面（按需加载）
const PlatformOperationPage = React.lazy(() => import('../pages/infra/operation'));
const TenantsPage = React.lazy(() => import('../pages/infra/tenants/list'));
const PackagesPage = React.lazy(() => import('../pages/infra/packages'));
const PlatformAdminPage = React.lazy(() => import('../pages/infra/admin'));
const ClientReleasesPage = React.lazy(() => import('../pages/infra/client-releases'));

const SystemRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<IndexPage />} />
    <Route path="/login" element={withLoginSuspense(LoginPage)} />
    <Route path="/infra/login" element={<Suspense fallback={null}><InfraLoginPage /></Suspense>} />
    <Route path="/lock-screen" element={<Suspense fallback={<PageSkeleton />}><LockScreenPage /></Suspense>} />
    <Route path="/init/wizard" element={<Suspense fallback={<PageSkeleton />}><InitWizardPage /></Suspense>} />
    <Route path="/init/template-select" element={<Suspense fallback={<PageSkeleton />}><TemplateSelectPage /></Suspense>} />
    <Route path="/qrcode/scan" element={<Suspense fallback={<PageSkeleton />}><QRCodeScanPage /></Suspense>} />
    <Route path="/docs" element={<Suspense fallback={<PageSkeleton />}><DocsPage /></Suspense>} />

    <Route path="/system/dashboard" element={<Navigate to="/system/dashboard/workplace" replace />} />
    <Route
      path="/system/dashboard/workplace"
      element={<SystemDashboardRouteGate>{withDashboardSuspense(DashboardPage)}</SystemDashboardRouteGate>}
    />
    <Route
      path="/system/dashboard/analysis"
      element={<SystemDashboardRouteGate>{withDashboardSuspense(DashboardAnalysisPage)}</SystemDashboardRouteGate>}
    />
    <Route path="/system/roles" element={withPermission(withSuspense(RolesPermissionsPage), ['system:role:read', 'system:role:update'])} />
    <Route path="/system/permissions" element={withPermission(withSuspense(PermissionsPage), ['system:permission:read', 'system:permission:update'])} />
    <Route path="/system/departments" element={withPermission(withSuspense(DepartmentsPage), ['system:department:read', 'system:department:update'])} />
    <Route path="/system/positions" element={withPermission(withSuspense(PositionsPage), ['system:position:read', 'system:position:update'])} />
    <Route path="/system/equipment" element={withSuspense(EquipmentPage)} />
    <Route path="/system/equipment/:uuid/trace" element={withSuspense(EquipmentTracePage)} />
    <Route path="/system/maintenance-plans" element={withSuspense(MaintenancePlansPage)} />
    <Route path="/system/equipment-faults" element={withSuspense(EquipmentFaultsPage)} />
    <Route path="/system/molds" element={withSuspense(MoldsPage)} />
    <Route path="/system/users" element={withPermission(withSuspense(UsersPage), ['system:user:read', 'system:user:update'])} />
    <Route path="/system/user-profile" element={withSuspense(UserProfilePage)} />
    <Route path="/system/languages" element={withPermission(withSuspense(LanguagesPage), ['system:language:read'])} />
    <Route path="/system/site-settings" element={withPermission(withSuspense(SiteSettingsPage), ['system:site-setting:read'])} />
    {/* 业务配置：主路径与组件一致（config-center → ConfigCenterPage），旧路径统一重定向 */}
    <Route path="/system/config-center" element={withPermission(withSuspense(ConfigCenterPage), ['system:config-center:read'])} />
    <Route path="/system/business-config" element={<Navigate to="/system/config-center" replace />} />
    <Route path="/system/system-parameters" element={<Navigate to="/system/config-center" replace />} />
    <Route path="/system/default-home" element={withSuspense(DefaultHomePage)} />
    <Route path="/system/applications" element={withPermission(withSuspense(ApplicationCenterPage), ['system:application:read'])} />
    <Route path="/system/plugin-manager" element={withPermission(withSuspense(PluginManagerPage), ['system:plugin-manager:read'])} />
    <Route path="/system/operation-logs" element={withPermission(withSuspense(OperationLogsPage), ['system:operation-log:read'])} />
    <Route path="/system/login-logs" element={withPermission(withSuspense(LoginLogsPage), ['system:login-log:read'])} />
    <Route path="/system/online-users" element={withPermission(withSuspense(OnlineUsersPage), ['system:online-user:read'])} />

    <Route path="/system/print-devices" element={withPermission(withSuspense(PrintDevicesPage), ['system:print-device:read'])} />
    <Route path="/system/print-templates" element={withPermission(withSuspense(PrintTemplatesPage), ['system:print-template:read'])} />
    <Route path="/system/print-templates/design/:uuid" element={withPermission(withSuspense(PrintTemplateDesignPage), ['system:print-template:update'])} />
    <Route path="/system/code-rules" element={withPermission(withSuspense(CodeRulesPage), ['system:code-rule:read'])} />
    <Route path="/system/data-dictionaries" element={withPermission(withSuspense(DataDictionariesPage), ['system:data-dictionary:read'])} />
    <Route path="/system/data-sources" element={withPermission(withSuspense(DataSourcesPage), ['system:data-source:read'])} />
    <Route path="/system/application-connections" element={withPermission(withSuspense(ApplicationConnectionsPage), ['system:application-connection:read'])} />
    <Route
      path="/system/initial-data"
      element={withPermission(withSuspense(InitialDataImportPage), ['kuaizhizao:warehouse-management-initial-data:read'])}
    />
    <Route path="/system/datasets" element={withPermission(withSuspense(DatasetsPage), ['system:dataset:read'])} />
    <Route path="/system/datasets/designer" element={withPermission(withSuspense(DatasetDesignerPage), ['system:dataset:update'])} />

    <Route path="/system/data-backups" element={withPermission(withSuspense(DataBackupsPage), ['system:data-backup:read'])} />
    <Route path="/system/custom-fields" element={withPermission(withSuspense(CustomFieldsPage), ['system:custom-field:read'])} />
    <Route path="/system/api-services" element={withPermission(withSuspense(ApiServicesPage), ['system:api:read'])} />
    <Route path="/system/apis" element={withPermission(withSuspense(ApiServicesPage), ['system:api:read'])} />
    <Route path="/system/integration-configs" element={withSuspense(IntegrationConfigsPage)} />
    <Route path="/system/message-templates" element={withPermission(withSuspense(MessageTemplatesPage), ['system:message-template:read'])} />
    <Route path="/system/messages/template" element={withPermission(withSuspense(MessageTemplatesPage), ['system:message-template:read'])} />
    <Route path="/system/message-configs" element={withPermission(withSuspense(MessageConfigsPage), ['system:message-config:read'])} />
    <Route path="/system/messages/config" element={withPermission(withSuspense(MessageConfigsPage), ['system:message-config:read'])} />
    <Route path="/system/menus" element={withPermission(withSuspense(MenusPage), ['system:menu:read'])} />
    <Route path="/system/files" element={withPermission(withSuspense(FilesPage), ['system:file:read'])} />
    <Route path="/system/approval-processes" element={withPermission(withSuspense(ApprovalProcessesPage), ['system:approval-process:read'])} />
    <Route path="/system/approval-processes/designer" element={withPermission(withSuspense(ApprovalProcessDesignerPage), ['system:approval-process:update'])} />
    <Route path="/system/approval-instances" element={withPermission(withSuspense(ApprovalInstancesPage), ['system:approval-instance:read'])} />
    <Route path="/system/report-templates" element={withPermission(withSuspense(ReportTemplatesPage), ['system:report-template:read'])} />
    <Route path="/system/report-templates/:id/design" element={withPermission(withSuspense(ReportDesignPage), ['system:report-template:read'])} />
    <Route path="/system/role-scenarios" element={withPermission(withSuspense(RoleScenariosPage), ['system:role-scenario:read'])} />
    <Route path="/system/onboarding-wizard" element={withPermission(withSuspense(OnboardingWizardPage), ['system:onboarding-wizard:read'])} />
    <Route path="/system/data-quality" element={withPermission(withSuspense(DataQualityPage), ['system:data-quality:read'])} />
    <Route path="/system/operation-guide" element={withPermission(withSuspense(OperationGuidePage), ['system:operation-guide:read'])} />
    <Route path="/system/launch-progress" element={withPermission(withSuspense(LaunchProgressPage), ['system:launch-progress:read'])} />
    <Route path="/system/usage-analysis" element={withPermission(withSuspense(UsageAnalysisPage), ['system:usage-analysis:read'])} />

    <Route path="/personal/profile" element={withPermission(withSuspense(PersonalProfilePage), ['system:user-profile:read'])} />
    <Route path="/personal/preferences" element={withPermission(withSuspense(PersonalPreferencesPage), ['system:user-preference:read'])} />
    <Route path="/personal/messages" element={withPermission(withSuspense(PersonalMessagesPage), ['system:user-message:read'])} />
    <Route path="/personal/tasks" element={withPermission(withSuspense(PersonalTasksPage), ['system:user-task:read'])} />

    <Route path="/infra/admin" element={withSuspense(PlatformAdminPage)} />
    <Route path="/infra/client-releases" element={withSuspense(ClientReleasesPage)} />
    <Route path="/infra/operation" element={withSuspense(PlatformOperationPage)} />
    <Route path="/platform/operation" element={withSuspense(PlatformOperationPage)} />
    <Route path="/infra/tenants" element={withSuspense(TenantsPage)} />
    <Route path="/infra/packages" element={withSuspense(PackagesPage)} />
    <Route path="/infra/scripts" element={withSuspense(ScriptsPage)} />
    <Route path="/infra/scheduled-tasks" element={withSuspense(ScheduledTasksPage)} />
    <Route path="/infra/monitoring" element={<Navigate to="/infra/admin" replace />} />
    <Route path="/infra/inngest" element={<Navigate to="/infra/admin" replace />} />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default SystemRoutes;
