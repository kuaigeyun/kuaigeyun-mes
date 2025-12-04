/**
 * RiverEdge SaaS 多组织框架 - 前端应用入口
 *
 * 使用现代化 React 生态技术栈：
 * - React 18.3.1 + TypeScript 5.6.3
 * - React Router DOM 6.26.2 (路由管理)
 * - Ant Design 5.21.4 + Pro Components 2.8.2 (UI组件)
 */

import React, { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { App as AntdApp, Spin, ConfigProvider, theme, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './services/auth';
import { getToken, clearAuth, getUserInfo } from './utils/auth';
import { useGlobalStore } from './stores';
import { loadUserLanguage } from './config/i18n';
import { getUserPreference, UserPreference } from './services/userPreference';
// 使用 routes 中的路由配置
import AppRoutes from './routes';
import ErrorBoundary from './components/error-boundary';

// 将 Ant Design message 实例注入到全局，供 api.ts 使用
if (typeof window !== 'undefined') {
  window.__ANTD_MESSAGE__ = message;
}

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();
  
  // 使用 useRef 跟踪是否已经初始化，避免重复执行
  const initializedRef = React.useRef(false);

  // 初始化时，如果有 token 但没有 currentUser，尝试从 localStorage 恢复用户信息
  React.useEffect(() => {
    // 只在首次挂载时执行一次
    if (initializedRef.current) {
      return;
    }
    
    const token = getToken();
    const savedUserInfo = getUserInfo();
    
    // 如果有 token 或保存的用户信息，但 currentUser 为空，尝试恢复
    // 注意：这里读取 currentUser 是为了检查是否需要恢复，但由于使用了 initializedRef，
    // 这个 effect 只会在首次挂载时执行一次，所以即使 currentUser 不在依赖数组中也是安全的
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
    
    // 标记为已初始化，避免重复执行
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次，使用 initializedRef 确保只执行一次

  // 使用 useMemo 计算是否应该获取用户信息，避免重复计算
  const shouldFetchUser = React.useMemo(() => {
    const token = getToken();
    return !!token && !currentUser && initializedRef.current;
  }, [currentUser]);

  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: shouldFetchUser,
    retry: false,
    onSuccess: (data) => {
      if (data) {
        setCurrentUser(data);
      }
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

  // 使用 useMemo 稳定重定向逻辑，避免无限循环
  const redirectTarget = React.useMemo(() => {
    // ⚠️ 核心逻辑：只有真正已登录（有 token 且 currentUser 存在）时才重定向
    // 如果只有 token 但没有 currentUser，说明可能还在加载中，不重定向
    const isAuthenticated = hasToken && currentUser;
    
    // 如果是公开页面且已登录，重定向到对应的仪表盘
    if (isPublicPath && isAuthenticated) {
      // 平台超管登录后，如果访问的是登录页，重定向到平台运营看板
      if (isPlatformLoginPage && currentUser.is_platform_admin) {
        return '/platform/operation';
      }
      // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘
      if (location.pathname === '/login' && !currentUser.is_platform_admin) {
        return '/system/dashboard';
      }
    }
    
    // ⚠️ 核心逻辑：只有没有 token 时才跳转到登录页
    // 有 token = 已登录，允许访问所有页面（包括功能菜单）
    if (!isPublicPath && !hasToken) {
      // 平台级路由重定向到平台登录页
      if (location.pathname.startsWith('/platform')) {
        return '/platform';
      }
      // 系统级路由重定向到用户登录页
      return '/login';
    }
    
    return null;
  }, [isPublicPath, currentUser, isPlatformLoginPage, location.pathname, hasToken]);

  // 如果需要重定向，执行重定向
  if (redirectTarget) {
    return <Navigate to={redirectTarget} replace />;
  }

  return <>{children}</>;
};

// 主应用组件
export default function App() {
  const [userPreference, setUserPreference] = useState<UserPreference | null>(null);
  const [themeConfig, setThemeConfig] = useState<{
    algorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm;
    token: { colorPrimary: string };
  }>({
    algorithm: theme.defaultAlgorithm,
    token: { colorPrimary: '#1890ff' },
  });

  // 初始化时加载用户偏好设置
  useEffect(() => {
    const token = getToken();
    if (token) {
      // 加载用户偏好设置
      getUserPreference()
        .then((preference) => {
          setUserPreference(preference);
          
          // 应用主题偏好
          const userTheme = preference?.preferences?.theme || 'light';
          if (userTheme === 'dark') {
            setThemeConfig({
              algorithm: theme.darkAlgorithm,
              token: { colorPrimary: '#1890ff' },
            });
          } else if (userTheme === 'auto') {
            // 自动模式：根据系统偏好决定
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setThemeConfig({
              algorithm: prefersDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
              token: { colorPrimary: '#1890ff' },
            });
          } else {
            // 默认浅色主题
            setThemeConfig({
              algorithm: theme.defaultAlgorithm,
              token: { colorPrimary: '#1890ff' },
            });
          }
          
          // 加载用户选择的语言
          return loadUserLanguage();
        })
        .catch((error) => {
          console.warn('Failed to load user preference:', error);
          // 如果加载失败，使用默认设置
          loadUserLanguage().catch((err) => {
            console.warn('Failed to load user language:', err);
          });
        });
    }
  }, []);

  // 监听系统主题变化（当用户偏好为 auto 时）
  useEffect(() => {
    if (userPreference?.preferences?.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setThemeConfig({
          algorithm: e.matches ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: { colorPrimary: '#1890ff' },
        });
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [userPreference?.preferences?.theme]);

  // 监听用户偏好更新事件
  useEffect(() => {
    const handlePreferenceUpdate = async (event: CustomEvent) => {
      // 重新加载用户偏好设置
      try {
        const preference = await getUserPreference();
        setUserPreference(preference);
        
        // 应用新的主题偏好
        const userTheme = preference?.preferences?.theme || 'light';
        if (userTheme === 'dark') {
          setThemeConfig({
            algorithm: theme.darkAlgorithm,
            token: { colorPrimary: '#1890ff' },
          });
        } else if (userTheme === 'auto') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setThemeConfig({
            algorithm: prefersDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: { colorPrimary: '#1890ff' },
          });
        } else {
          setThemeConfig({
            algorithm: theme.defaultAlgorithm,
            token: { colorPrimary: '#1890ff' },
          });
        }
      } catch (error) {
        console.warn('Failed to reload user preference:', error);
      }
    };
    
    window.addEventListener('userPreferenceUpdated', handlePreferenceUpdate as EventListener);
    return () => {
      window.removeEventListener('userPreferenceUpdated', handlePreferenceUpdate as EventListener);
    };
  }, []);

  return (
    <ConfigProvider theme={themeConfig}>
            <AntdApp>
              <ErrorBoundary>
                <AuthGuard>
                  <AppRoutes />
                </AuthGuard>
              </ErrorBoundary>
            </AntdApp>
    </ConfigProvider>
  );
}
