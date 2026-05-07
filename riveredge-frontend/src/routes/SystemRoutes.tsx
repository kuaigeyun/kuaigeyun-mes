/**
 * 系统核心路由
 *
 * 这些路由不依赖应用加载，即使应用层完全失效，系统核心功能也能正常工作
 *
 * 性能优化：系统级/平台级页面按需懒加载，仅首屏核心页面立即加载
 *
 * 约定：URL 路径与渲染组件所在目录一致，避免歧义（如 /system/config-center 对应 config-center 页面）。
 * 旧路径通过 Navigate 重定向到主路径，兼容书签与历史链接。
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
 * 初始 delayMs 内渲染 null，超时后才显示骨架屏，避免快速加载时的闪烁
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

// 懒加载包装：主内容区统一骨架（DelayedFallback 默认 variant=content）
const withSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback />}><LazyComponent /></Suspense>
);

const withLoginSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={null}><LazyComponent /></Suspense>
);

const withDashboardSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback />}><LazyComponent /></Suspense>
);

// 角色权限页专用，骨架屏边距与左右分栏布局一致
const withRolesPermissionsSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback variant="rolesPermissions" />}><LazyComponent /></Suspense>
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
    <Route path="/system/dashboard/workplace" element={withDashboardSuspense(DashboardPage)} />
    <Route path="/system/dashboard/analysis" element={withDashboardSuspense(DashboardAnalysisPage)} />
    <Route path="/system/roles" element={withPermission(withRolesPermissionsSuspense(RolesPermissionsPage), ['system:role:read', 'system:role:update'])} />
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
    <Route path="/system/languages" element={withSuspense(LanguagesPage)} />
    <Route path="/system/site-settings" element={withSuspense(SiteSettingsPage)} />
    {/* 业务配置：主路径与组件一致（config-center → ConfigCenterPage），旧路径兼容重定向 */}
    <Route path="/system/config-center" element={withSuspense(ConfigCenterPage)} />
    <Route path="/system/business-config" element={<Navigate to="/system/config-center" replace />} />
    <Route path="/system/system-parameters" element={<Navigate to="/system/config-center" replace />} />
    <Route path="/system/applications" element={withSuspense(ApplicationCenterPage)} />
    <Route path="/system/plugin-manager" element={withSuspense(PluginManagerPage)} />
    <Route path="/system/operation-logs" element={withSuspense(OperationLogsPage)} />
    <Route path="/system/login-logs" element={withSuspense(LoginLogsPage)} />
    <Route path="/system/online-users" element={withSuspense(OnlineUsersPage)} />

    <Route path="/system/print-devices" element={withSuspense(PrintDevicesPage)} />
    <Route path="/system/print-templates" element={withSuspense(PrintTemplatesPage)} />
    <Route path="/system/print-templates/design/:uuid" element={withSuspense(PrintTemplateDesignPage)} />
    <Route path="/system/code-rules" element={withSuspense(CodeRulesPage)} />
    <Route path="/system/data-dictionaries" element={withSuspense(DataDictionariesPage)} />
    <Route path="/system/data-sources" element={withSuspense(DataSourcesPage)} />
    <Route path="/system/application-connections" element={withSuspense(ApplicationConnectionsPage)} />
    <Route
      path="/system/initial-data"
      element={withPermission(withSuspense(InitialDataImportPage), ['kuaizhizao:warehouse-management-initial-data:read'])}
    />
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

    <Route path="/personal/profile" element={withSuspense(PersonalProfilePage)} />
    <Route path="/personal/preferences" element={withSuspense(PersonalPreferencesPage)} />
    <Route path="/personal/messages" element={withSuspense(PersonalMessagesPage)} />
    <Route path="/personal/tasks" element={withSuspense(PersonalTasksPage)} />

    <Route path="/infra/admin" element={withSuspense(PlatformAdminPage)} />
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
