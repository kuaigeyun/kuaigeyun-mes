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
import LoginSkeleton from '../components/login-skeleton';
import { useGlobalStore } from '../stores/globalStore';
import { hasAnyPermission } from '../utils/permission';

// 核心页面（立即加载，首屏必需）
import IndexPage from '../pages';
import NotFoundPage from '../pages/404';

// 登录页懒加载（第一印象页，按需加载以减小主包）
// 注意：登录页统一走主应用 SPA 渲染。曾经存在的独立 MPA（src/login.html + vite.login.config.ts）
// 因双轨制（首次 SPA navigate / 刷新 Caddy 加载 login.html）以及独立 bundle 在生产环境运行时挂载失败等问题，
// 已废弃；Caddy @login 块 try_files 也改为 /index.html，确保 /login 任何来源都走同一份主应用 bundle。
const LoginPage = React.lazy(() => import('../pages/login'));
// 公开页面按需懒加载，减小主包体积，加快登录首屏
const InfraLoginPage = React.lazy(() => import('../pages/infra/login'));
const LockScreenPage = React.lazy(() => import('../pages/lock-screen'));
const InitWizardPage = React.lazy(() => import('../pages/init/wizard'));
const TemplateSelectPage = React.lazy(() => import('../pages/init/template-select'));
const QRCodeScanPage = React.lazy(() => import('../pages/qrcode/scan'));

/**
 * 延迟显示的 Fallback 组件
 * 初始 delayMs 内渲染 null，超时后才显示骨架屏，避免快速加载时的闪烁
 */
const DelayedFallback: React.FC<{ variant?: PageSkeletonProps['variant']; delayMs?: number }> = ({ 
  variant = 'minimal', 
  delayMs = 150 
}) => {
  const [show, setShow] = React.useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
  return show ? <PageSkeleton variant={variant} /> : null;
};

// 懒加载包装（极简 fallback）
// 与 hover/父分组 prefetch 配合：大多数点击发生时 chunk 已在缓存，
// fallback 仅在极短窗口内（>150ms）出现，采用最轻量骨架屏。
const withSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback variant="minimal" />}><LazyComponent /></Suspense>
);

// 登录页专用骨架屏（与登录页布局一致）
const withLoginSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<LoginSkeleton />}><LazyComponent /></Suspense>
);

// 工作台/分析页专用，骨架屏边距与 DashboardTemplate 一致
const withDashboardSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<DelayedFallback variant="dashboard" />}><LazyComponent /></Suspense>
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
    <Route path="/infra/login" element={<Suspense fallback={<LoginSkeleton />}><InfraLoginPage /></Suspense>} />
    <Route path="/lock-screen" element={<Suspense fallback={<PageSkeleton />}><LockScreenPage /></Suspense>} />
    <Route path="/init/wizard" element={<Suspense fallback={<PageSkeleton />}><InitWizardPage /></Suspense>} />
    <Route path="/init/template-select" element={<Suspense fallback={<PageSkeleton />}><TemplateSelectPage /></Suspense>} />
    <Route path="/qrcode/scan" element={<Suspense fallback={<PageSkeleton />}><QRCodeScanPage /></Suspense>} />

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
