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
import { App as AntdApp, Spin, ConfigProvider, theme, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './services/auth';
import { getToken, clearAuth, getUserInfo } from './utils/auth';
import { useGlobalStore } from './stores';
// 使用 maintree 中的路由配置
import AppRoutes from '../maintree/routes';

// 将 Ant Design message 实例注入到全局，供 api.ts 使用
if (typeof window !== 'undefined') {
  window.__ANTD_MESSAGE__ = message;
}

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();

  // 初始化时，如果有 token 但没有 currentUser，尝试从 localStorage 恢复用户信息
  React.useEffect(() => {
    const token = getToken();
    const savedUserInfo = getUserInfo();
    
    // 如果有 token 或保存的用户信息，但 currentUser 为空，尝试恢复
    if ((token || savedUserInfo) && !currentUser) {
      if (savedUserInfo) {
        // 从 localStorage 恢复用户信息
        const restoredUser = {
          id: savedUserInfo.id || 1,
          username: savedUserInfo.username || 'admin',
          email: savedUserInfo.email,
          full_name: savedUserInfo.full_name,
          is_platform_admin: savedUserInfo.user_type === 'platform_superadmin' || savedUserInfo.is_platform_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
        };
        setCurrentUser(restoredUser);
      }
    }
  }, []); // 只在组件挂载时执行一次

  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: !!getToken() && !currentUser,
    retry: false,
    onSuccess: (data) => {
      setCurrentUser(data);
    },
    onError: (error) => {
      // 如果有 token，尝试从 localStorage 恢复用户信息
      const token = getToken();
      const savedUserInfo = getUserInfo();
      
      if (token && savedUserInfo) {
        // 从 localStorage 恢复用户信息，允许继续访问
        const restoredUser = {
          id: savedUserInfo.id || 1,
          username: savedUserInfo.username || 'admin',
          email: savedUserInfo.email,
          full_name: savedUserInfo.full_name,
          is_platform_admin: savedUserInfo.user_type === 'platform_superadmin' || savedUserInfo.is_platform_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
        };
        setCurrentUser(restoredUser);
        console.warn('⚠️ 获取用户信息失败，使用本地缓存:', error);
      } else if (token) {
        // 有 token 但没有保存的用户信息，使用默认值
        setCurrentUser({
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          is_platform_admin: true,
          is_tenant_admin: true,
          tenant_id: 1,
        });
        console.warn('⚠️ 获取用户信息失败，使用默认值:', error);
      } else {
        // 没有 token，清理认证信息
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

  // 检查是否有 token（这是判断是否登录的唯一标准）
  const token = getToken();
  const hasToken = !!token;

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

  // ⚠️ 核心逻辑：只有没有 token 时才跳转到登录页
  // 有 token = 已登录，允许访问所有页面（包括功能菜单）
  if (!isPublicPath && !hasToken) {
    // 平台级路由重定向到平台登录页
    if (location.pathname.startsWith('/platform')) {
      return <Navigate to="/platform" replace />;
    }
    // 系统级路由重定向到用户登录页
    return <Navigate to="/login" replace />;
  }

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
