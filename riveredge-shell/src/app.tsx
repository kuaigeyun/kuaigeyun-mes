/**
 * RiverEdge SaaS 多租户框架 - 前端应用入口
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
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import IndexPage from '@/pages';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import DashboardPage from '@/pages/dashboard';
import UserListPage from '@/pages/user/list';
import UserFormPage from '@/pages/user/form';
import RoleListPage from '@/pages/role/list';
import RoleFormPage from '@/pages/role/form';
import RolePermissionsPage from '@/pages/role/permissions';
import TenantListPage from '@/pages/tenant/list';
import TenantDetailPage from '@/pages/tenant/detail';
import TenantFormPage from '@/pages/tenant/form';
import SuperAdminTenantListPage from '@/pages/superadmin/tenants/list';
import SuperAdminTenantDetailPage from '@/pages/superadmin/tenants/detail';
import NotFoundPage from '@/pages/404';
import BasicLayout from '@/layouts/BasicLayout';
import { getCurrentUser } from '@/services/auth';
import { CurrentUser } from '@/types/api';
import { getToken, clearAuth } from '@/utils/auth';

// 全局状态管理
interface GlobalState {
  currentUser?: CurrentUser;
  loading: boolean;
  setCurrentUser: (user?: CurrentUser) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  }

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      currentUser: undefined,
      loading: false,
      setCurrentUser: (user) => set({ currentUser: user }),
      setLoading: (loading) => set({ loading }),
      logout: () => {
    clearAuth();
        set({ currentUser: undefined });
      window.location.href = '/login';
      },
    }),
    {
      name: 'riveredge-global-store',
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);

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
  const publicPaths = ['/login', '/register'];
  const isPublicPath = publicPaths.includes(location.pathname);

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

      {/* 租户管理 */}
      <Route
        path="/tenants"
        element={
          <AuthGuard>
            <BasicLayout>
              <TenantListPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/tenants/create"
        element={
          <AuthGuard>
            <BasicLayout>
              <TenantFormPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/tenants/:id"
        element={
          <AuthGuard>
            <BasicLayout>
              <TenantDetailPage />
            </BasicLayout>
          </AuthGuard>
        }
      />

      {/* 超级管理员 */}
      <Route
        path="/superadmin/tenants"
        element={
          <AuthGuard>
            <BasicLayout>
              <SuperAdminTenantListPage />
            </BasicLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/superadmin/tenants/:id"
        element={
          <AuthGuard>
            <BasicLayout>
              <SuperAdminTenantDetailPage />
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
