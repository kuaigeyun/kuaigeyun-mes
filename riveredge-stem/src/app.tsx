/**
 * RiverEdge SaaS 多组织框架 - 前端应用入口
 * 
 * 使用现代化 React 生态技术栈：
 * - React 18.2.0 + TypeScript 5.5.4
 * - React Router DOM 6.22.0 (路由管理)
 * - Zustand 4.5.0 (状态管理)
 * - TanStack Query 5.45.0 (数据获取)
 * - Ant Design 5.17.0 + Pro Components 2.7.10 (UI组件)
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { App as AntdApp, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import IndexPage from '@/pages';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import PersonalRegisterPage from '@/pages/register/personal';
import OrganizationRegisterPage from '@/pages/register/organization';
import DashboardPage from '@/pages/dashboard';
import UserListPage from '@/pages/system/user/list';
import UserFormPage from '@/pages/system/user/form';
import RoleListPage from '@/pages/system/role/list';
import RoleFormPage from '@/pages/system/role/form';
import RolePermissionsPage from '@/pages/system/role/permissions';
import SuperAdminTenantListPage from '@/pages/operations/tenants/list';
import SuperAdminTenantDetailPage from '@/pages/operations/tenants/detail';
import OperationsDashboardPage from '@/pages/operations/dashboard';
import SystemMonitoringPage from '@/pages/operations/monitoring';
import PackagesPage from '@/pages/operations/packages';
import NotFoundPage from '@/pages/404';
import BasicLayout from '@/layouts/BasicLayout';
import { getCurrentUser } from '@/services/auth';
import { getToken, clearAuth } from '@/utils/auth';
import { useGlobalStore } from '@/stores';

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();

  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: !!getToken() && !currentUser,
    retry: false,
    onSuccess: (data) => {
      setCurrentUser(data);
    },
    onError: () => {
      clearAuth();
      setCurrentUser(undefined);
    },
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // 公开页面
  const publicPaths = ['/login', '/register', '/register/personal', '/register/organization'];
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // 如果是公开页面且已登录，重定向到首页
  if (isPublicPath && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  // 如果不是公开页面且未登录，重定向到登录页
  if (!isPublicPath && !currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 路由配置
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 首页重定向 */}
      <Route path="/" element={<IndexPage />} />

      {/* 公开页面 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/personal" element={<PersonalRegisterPage />} />
      <Route path="/register/organization" element={<OrganizationRegisterPage />} />

      {/* 需要认证的页面 */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <BasicLayout>
              <DashboardPage />
            </BasicLayout>
          </AuthGuard>
        }
      />

      {/* 用户管理 */}
      <Route
        path="/users"
        element={
          <AuthGuard>
            <BasicLayout>
              <UserListPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/users/create"
        element={
          <AuthGuard>
            <BasicLayout>
              <UserFormPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/users/:id/edit"
        element={
          <AuthGuard>
            <BasicLayout>
              <UserFormPage />
            </BasicLayout>
          </AuthGuard>
        }
      />

      {/* 角色管理 */}
      <Route
        path="/roles"
        element={
          <AuthGuard>
            <BasicLayout>
              <RoleListPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/roles/create"
        element={
          <AuthGuard>
            <BasicLayout>
              <RoleFormPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/roles/:id/edit"
        element={
          <AuthGuard>
            <BasicLayout>
              <RoleFormPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/roles/:id/permissions"
        element={
          <AuthGuard>
            <BasicLayout>
              <RolePermissionsPage />
            </BasicLayout>
          </AuthGuard>
        }
      />

      {/* 运营中心（仅超级管理员可见） */}
      <Route
        path="/operations/dashboard"
        element={
          <AuthGuard>
            <BasicLayout>
              <OperationsDashboardPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/operations/tenants"
        element={
          <AuthGuard>
            <BasicLayout>
              <SuperAdminTenantListPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/operations/tenants/:id"
        element={
          <AuthGuard>
            <BasicLayout>
              <SuperAdminTenantDetailPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/operations/monitoring"
        element={
          <AuthGuard>
            <BasicLayout>
              <SystemMonitoringPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/operations/packages"
        element={
          <AuthGuard>
            <BasicLayout>
              <PackagesPage />
            </BasicLayout>
          </AuthGuard>
        }
      />

      {/* 404页面 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// 主应用组件
export default function App() {
  return (
    <AntdApp>
      <AppRoutes />
    </AntdApp>
  );
}
