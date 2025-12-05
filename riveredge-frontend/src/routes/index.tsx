/**
 * 路由配置
 *
 * 统一使用 SaaS 模式
 * 单体部署本质上就是只有 routes，没有新建其他租户应用
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

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
// 从 app 导入布局组件（布局组件需要立即加载）
import BasicLayout from '../layouts/BasicLayout';

// 加载中组件
const LoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh'
  }}>
    <Spin size="large" />
  </div>
);

// 公共页面（立即加载，不需要懒加载）
import IndexPage from '../pages';
import LoginPage from '../pages/login';
import RegisterPage from '../pages/register';
import PersonalRegisterPage from '../pages/register/personal';
import OrganizationRegisterPage from '../pages/register/organization';
import NotFoundPage from '../pages/404';
import PlatformLoginPage from '../pages/platform/login';

// 懒加载系统级页面（按功能模块分组）
const SystemDashboardPage = lazy(() => import('../pages/system/dashboard'));
const AnalysisPage = lazy(() => import('../pages/system/dashboard/analysis'));

// 权限管理模块
const RoleListPage = lazy(() => import('../pages/system/roles/list'));
const PermissionListPage = lazy(() => import('../pages/system/permissions/list'));

// 组织管理模块
const DepartmentListPage = lazy(() => import('../pages/system/departments/list'));
const PositionListPage = lazy(() => import('../pages/system/positions/list'));
const UserListPage = lazy(() => import('../pages/system/users/list'));

// 核心配置模块
const DataDictionaryListPage = lazy(() => import('../pages/system/data-dictionaries/list'));
const SystemParameterListPage = lazy(() => import('../pages/system/system-parameters/list'));
const CodeRuleListPage = lazy(() => import('../pages/system/code-rules/list'));
const CustomFieldListPage = lazy(() => import('../pages/system/custom-fields/list'));
const LanguageListPage = lazy(() => import('../pages/system/languages/list'));
const SiteSettingsPage = lazy(() => import('../pages/system/site-settings'));

// 应用中心模块
const ApplicationListPage = lazy(() => import('../pages/system/applications/list'));
const MenuListPage = lazy(() => import('../pages/system/menus'));
const InvitationCodeListPage = lazy(() => import('../pages/system/invitation-codes/list'));

// 数据中心模块
const FileListPage = lazy(() => import('../pages/system/files/list'));
const APIListPage = lazy(() => import('../pages/system/apis/list'));
const DataSourceListPage = lazy(() => import('../pages/system/data-sources/list'));
const DatasetListPage = lazy(() => import('../pages/system/datasets/list'));
const IntegrationConfigListPage = lazy(() => import('../pages/system/integration-configs/list'));

// 流程管理模块
const MessageConfigListPage = lazy(() => import('../pages/system/messages/config'));
const MessageTemplateListPage = lazy(() => import('../pages/system/messages/template'));
const ScheduledTaskListPage = lazy(() => import('../pages/system/scheduled-tasks/list'));
const ApprovalProcessListPage = lazy(() => import('../pages/system/approval-processes/list'));
const ApprovalInstanceListPage = lazy(() => import('../pages/system/approval-processes/instances'));
const ApprovalProcessDesignerPage = lazy(() => import('../pages/system/approval-processes/designer'));
const ElectronicRecordListPage = lazy(() => import('../pages/system/electronic-records/list'));
const ScriptListPage = lazy(() => import('../pages/system/scripts/list'));
const PrintTemplateListPage = lazy(() => import('../pages/system/print-templates/list'));
const PrintDeviceListPage = lazy(() => import('../pages/system/print-devices/list'));

// 个人中心模块
const UserProfilePage = lazy(() => import('../pages/personal/profile'));
const UserPreferencesPage = lazy(() => import('../pages/personal/preferences'));
const UserMessagesPage = lazy(() => import('../pages/personal/messages'));
const UserTasksPage = lazy(() => import('../pages/personal/tasks'));

// 监控运维模块
const InngestDashboardPage = lazy(() => import('../pages/system/inngest'));
const OperationLogsPage = lazy(() => import('../pages/system/operation-logs'));
const LoginLogsPage = lazy(() => import('../pages/system/login-logs'));
const OnlineUsersPage = lazy(() => import('../pages/system/online-users'));
const DataBackupsPage = lazy(() => import('../pages/system/data-backups'));

// 平台级页面（懒加载）
const PlatformDashboardPage = lazy(() => import('../pages/platform/operation'));
const TenantListPage = lazy(() => import('../pages/platform/tenants/list'));
const TenantDetailPage = lazy(() => import('../pages/platform/tenants/detail'));
const PlatformSuperAdminPage = lazy(() => import('../pages/platform'));
const PackageManagementPage = lazy(() => import('../pages/platform/packages'));
const MonitoringPage = lazy(() => import('../pages/platform/monitoring'));

// 布局包装组件（支持懒加载）
const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BasicLayout>
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
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
      <Route path="/system/dashboard" element={<LayoutWrapper><SystemDashboardPage /></LayoutWrapper>} />
      <Route path="/system/dashboard/workplace" element={<LayoutWrapper><SystemDashboardPage /></LayoutWrapper>} />
      <Route path="/system/dashboard/analysis" element={<LayoutWrapper><AnalysisPage /></LayoutWrapper>} />
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
      {/* 菜单管理 */}
      <Route
        path="/system/menus"
        element={
          <LayoutWrapper>
            <MenuListPage />
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
      {/* 文件管理 */}
      <Route
        path="/system/files"
        element={
          <LayoutWrapper>
            <FileListPage />
          </LayoutWrapper>
        }
      />
      {/* 接口管理 */}
      <Route
        path="/system/apis"
        element={
          <LayoutWrapper>
            <APIListPage />
          </LayoutWrapper>
        }
      />
      {/* 数据源管理 */}
      <Route
        path="/system/data-sources"
        element={
          <LayoutWrapper>
            <DataSourceListPage />
          </LayoutWrapper>
        }
      />
      {/* 数据集管理 */}
      <Route
        path="/system/datasets"
        element={
          <LayoutWrapper>
            <DatasetListPage />
          </LayoutWrapper>
        }
      />
      {/* 消息配置管理 */}
      <Route
        path="/system/messages/config"
        element={
          <LayoutWrapper>
            <MessageConfigListPage />
          </LayoutWrapper>
        }
      />
      {/* 消息模板管理 */}
      <Route
        path="/system/messages/template"
        element={
          <LayoutWrapper>
            <MessageTemplateListPage />
          </LayoutWrapper>
        }
      />
      {/* 定时任务管理 */}
      <Route
        path="/system/scheduled-tasks"
        element={
          <LayoutWrapper>
            <ScheduledTaskListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/approval-processes"
        element={
          <LayoutWrapper>
            <ApprovalProcessListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/approval-processes/designer"
        element={
          <LayoutWrapper>
            <ApprovalProcessDesignerPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/approval-instances"
        element={
          <LayoutWrapper>
            <ApprovalInstanceListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/electronic-records"
        element={
          <LayoutWrapper>
            <ElectronicRecordListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/scripts"
        element={
          <LayoutWrapper>
            <ScriptListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/print-templates"
        element={
          <LayoutWrapper>
            <PrintTemplateListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/system/print-devices"
        element={
          <LayoutWrapper>
            <PrintDeviceListPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/personal/profile"
        element={
          <LayoutWrapper>
            <UserProfilePage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/personal/preferences"
        element={
          <LayoutWrapper>
            <UserPreferencesPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/personal/messages"
        element={
          <LayoutWrapper>
            <UserMessagesPage />
          </LayoutWrapper>
        }
      />
      <Route
        path="/personal/tasks"
        element={
          <LayoutWrapper>
            <UserTasksPage />
          </LayoutWrapper>
        }
      />
      {/* Inngest Dashboard */}
      <Route
        path="/system/inngest"
        element={
          <LayoutWrapper>
            <InngestDashboardPage />
          </LayoutWrapper>
        }
      />
      {/* 操作日志 */}
      <Route
        path="/system/operation-logs"
        element={
          <LayoutWrapper>
            <OperationLogsPage />
          </LayoutWrapper>
        }
      />
      {/* 登录日志 */}
      <Route
        path="/system/login-logs"
        element={
          <LayoutWrapper>
            <LoginLogsPage />
          </LayoutWrapper>
        }
      />
      {/* 在线用户 */}
      <Route
        path="/system/online-users"
        element={
          <LayoutWrapper>
            <OnlineUsersPage />
          </LayoutWrapper>
        }
      />
      {/* 数据备份 */}
      <Route
        path="/system/data-backups"
        element={
          <LayoutWrapper>
            <DataBackupsPage />
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

