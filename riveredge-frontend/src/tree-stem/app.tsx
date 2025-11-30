/**
 * RiverEdge SaaS 多组织框架 - 前端应用入口
 *
 * 使用现代化 React 生态技术栈：
 * - React 18.3.1 + TypeScript 5.6.3
 * - React Router DOM 6.26.2 (路由管理)
 * - Ant Design 5.21.4 + Pro Components 2.8.2 (UI组件)
 */

import React, { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { App as AntdApp, Spin, ConfigProvider, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './services/auth';
import { getToken, clearAuth } from './utils/auth';
import { useGlobalStore } from './stores';
// 使用 maintree 中的路由配置
import AppRoutes from '../maintree/routes';

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
    onError: (error) => {
      // 临时：后端未对接时，不清理认证信息，允许继续访问
      console.warn('⚠️ 获取用户信息失败（后端未对接）:', error);
      // 如果有 token，使用模拟用户数据
      if (getToken()) {
        setCurrentUser({
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          is_platform_admin: true,
          is_tenant_admin: true,
          tenant_id: 1,
        });
      } else {
        clearAuth();
        setCurrentUser(undefined);
      }
    },
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // 公开页面（只包括登录和注册页面，不包括平台管理页面）
  const publicPaths = ['/login', '/register', '/register/personal', '/register/organization'];
  // 平台登录页是公开的，但其他平台页面需要登录
  const isPlatformLoginPage = location.pathname === '/platform' || location.pathname === '/platform/login';
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path)) || isPlatformLoginPage;

  // 如果正在加载，显示加载状态
  if (loading || isLoading) {
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

  // ⚠️ 关键修复：如果有 token 但 currentUser 不存在，且正在获取用户信息，等待加载完成
  // 避免在数据加载过程中误判为未登录
  if (getToken() && !currentUser) {
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

  // 如果是公开页面且已登录，重定向到对应的仪表盘
  if (isPublicPath && currentUser) {
    // 平台超管登录后，如果访问的是登录页，重定向到平台运营看板
    if (isPlatformLoginPage && currentUser.is_platform_admin) {
      return <Navigate to="/platform/operation" replace />;
    }
    // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘
    if (location.pathname === '/login' && !currentUser.is_platform_admin) {
      return <Navigate to="/system/dashboard" replace />;
    }
  }

  // ⚠️ 临时禁用：移除自动重定向逻辑，让错误能够正常显示
  // 如果不是公开页面且未登录，不自动重定向，让错误正常显示
  // if (!isPublicPath && !currentUser && !getToken()) {
  //   // 平台级路由重定向到平台登录页
  //   if (location.pathname.startsWith('/platform')) {
  //     return <Navigate to="/platform" replace />;
  //   }
  //   // 系统级路由重定向到用户登录页
  //   return <Navigate to="/login" replace />;
  // }

  return <>{children}</>;
};

// 主应用组件
export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // 浅色主题算法
        token: {
          // 可以在这里自定义主题token
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      </AntdApp>
    </ConfigProvider>
  );
}
