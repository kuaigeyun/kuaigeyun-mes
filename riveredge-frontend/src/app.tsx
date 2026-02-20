/**
 * RiverEdge SaaS 多组织框架 - 前端应用入口
 *
 * 使用现代化 React 生态技术栈：
 * - React 18.3.1 + TypeScript 5.6.3
 * - React Router DOM 6.26.2 (路由管理)
 * - Ant Design 6.1.0 + Pro Components 2.8.2 (UI组件)
 */

import React, { useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { setNavigateRef } from './utils/navigation';
import { App as AntdApp, Spin, ConfigProvider, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './services/auth';
import { getToken, clearAuth, getUserInfo, setUserInfo, setTenantId, isTokenExpired } from './utils/auth';
import { prefetchAvatarUrl } from './utils/avatar';
import { useGlobalStore } from './stores';
import i18n, { loadUserLanguage } from './config/i18n';
import { useConfigStore } from './stores/configStore';
import { useUserPreferenceStore } from './stores/userPreferenceStore';
import { useThemeStore } from './stores/themeStore';
import { updateLastActivity, getLastActivityTime } from './utils/activityUtils';
import { useTouchScreen } from './hooks/useTouchScreen';
// 使用 routes 中的路由配置
import MainRoutes from './routes';
import ErrorBoundary from './components/error-boundary';

// ⚠️ 关键修复：将 Ant Design App 组件的 message 实例注入到全局，供工具函数使用
// 这样可以避免 Ant Design 6.0 的警告："Static function can not consume context like dynamic theme"
// 注意：这个实例会在 App 组件渲染后通过 useApp() hook 设置
if (typeof window !== 'undefined') {
  // 先设置一个占位符，实际实例会在 App 组件内部设置
  (window as any).__ANTD_MESSAGE__ = null;
}

// 权限守卫组件（memo 阻断上层频繁重渲染的级联）
const AuthGuard = React.memo<{ children: React.ReactNode }>(({ children }) => {
  const location = useLocation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const loading = useGlobalStore((s) => s.loading);
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  const setLoading = useGlobalStore((s) => s.setLoading);

  // ⚠️ 关键修复：将所有路径检查移到 Hook 调用之前，避免 Hook 顺序问题
  const isMasterDataPath = location.pathname.startsWith('/apps/master-data');
  const isDebugPath = location.pathname.startsWith('/debug/');

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
          is_infra_admin: savedUserInfo.user_type === 'infra_superadmin' || savedUserInfo.is_infra_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
          tenant_name: savedUserInfo.tenant_name, // ⚠️ 关键修复：恢复租户名称
        };
        setCurrentUser(restoredUser);
        setUserInfo(restoredUser);
        if (savedUserInfo.tenant_id != null) {
          setTenantId(savedUserInfo.tenant_id);
        }
      }
    }

    // 标记为已初始化，避免重复执行
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次，使用 initializedRef 确保只执行一次

  // 公开页面：根路径、登录、初始化向导等，无需鉴权即可访问
  const pathname = location.pathname;
  const isPublicPath = pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname === '/infra/login' ||
    pathname.startsWith('/lock-screen') ||
    pathname.startsWith('/init/') ||
    pathname.startsWith('/debug/') ||
    pathname.startsWith('/qrcode/');
  const isInfraLoginPage = pathname === '/infra/login';

  // 使用 useMemo 计算是否应该获取用户信息，避免重复计算
  // ⚠️ 关键修复：在公开页面（如登录页）不应该尝试获取用户信息，避免后端未运行时出现连接错误
  const shouldFetchUser = React.useMemo(() => {
    const token = getToken();
    // 如果是公开页面，不尝试获取用户信息（避免后端未运行时出现连接错误）
    if (isPublicPath) {
      return false;
    }
    return !!token && !currentUser && initializedRef.current;
  }, [currentUser, isPublicPath]);

  const { data: userData, isLoading, isError, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: shouldFetchUser,
    retry: false,
  });

  // 处理用户信息加载成功
  useEffect(() => {
    if (userData) {
      setCurrentUser(userData);
      setUserInfo(userData);
      // 尽早预取头像 URL，与 BasicLayout 的请求复用，缩短顶栏头像显示延迟
      if (userData.avatar) prefetchAvatarUrl(userData.avatar);
    }
  }, [userData, setCurrentUser]);

  // 处理用户信息加载失败
  useEffect(() => {
    if (isError) {
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
          is_infra_admin: savedUserInfo.user_type === 'infra_superadmin' || savedUserInfo.is_infra_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
          tenant_name: savedUserInfo.tenant_name, // ⚠️ 关键修复：恢复租户名称
        };
        setCurrentUser(restoredUser);
        // ⚠️ 关键修复：确保恢复的用户信息也保存到 localStorage
        setUserInfo(restoredUser);
        console.warn('⚠️ 获取用户信息失败，使用本地缓存:', error);
      } else if (token) {
        // 有 token 但没有保存的用户信息，使用默认值
        setCurrentUser({
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          is_infra_admin: true,
          is_tenant_admin: true,
          tenant_id: 1,
        });
        console.warn('⚠️ 获取用户信息失败，使用默认值:', error);
      } else {
        // 没有 token，清理认证信息
        clearAuth();
        setCurrentUser(undefined);
      }
    }
  }, [isError, error, setCurrentUser]);

  useEffect(() => {
    // 公开页面不拉取用户信息，直接清除 loading，避免登录页循环加载
    if (isPublicPath) {
      setLoading(false);
      return;
    }
    setLoading(isLoading);
  }, [isLoading, isPublicPath, setLoading]);

  // 引入 useConfigStore
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);
  const getConfig = useConfigStore((s) => s.getConfig);
  const configInitialized = useConfigStore((s) => s.initialized);

  // 初始化系统配置
  useEffect(() => {
    if (currentUser && !configInitialized) {
      fetchConfigs();
    }
  }, [currentUser, configInitialized, fetchConfigs]);

  // 监听用户活动（仅用户操作时更新，API 请求由 api.ts 在成功响应时更新）
  useEffect(() => {
    if (isPublicPath) return;

    // 进入受保护页面时重置活动时间（清除可能来自上一会话的旧数据）
    updateLastActivity(true);

    const onActivity = () => updateLastActivity();

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    window.addEventListener('scroll', onActivity);
    window.addEventListener('touchstart', onActivity);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [isPublicPath]);

  // TOKEN 过期与不活动检测
  React.useEffect(() => {
    // 如果是公开页面，不需要检测
    if (isPublicPath) {
      return;
    }

    const token = getToken();
    if (!token) {
      return;
    }

    // 获取配置参数（默认值作为后备）
    const checkInterval = getConfig('security.token_check_interval', 60) * 1000;
    const inactivityTimeout = getConfig('security.inactivity_timeout', 1800) * 1000; // 默认30分钟

    // 检查 TOKEN 是否过期
    const checkAuthStatus = () => {
      const currentToken = getToken();
      if (!currentToken) {
        return false;
      }

      // 1. 检查 Token 过期
      if (isTokenExpired(currentToken)) {
        console.warn('⚠️ TOKEN 已过期，清除认证信息并跳转到登录页');
        handleLogout();
        return false;
      }

      // 2. 检查用户不活动超时 (0表示禁用)，仅当无用户操作且无 API 请求时才超时
      if (inactivityTimeout > 0) {
        const lastActivityTime = getLastActivityTime();
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > inactivityTimeout) {
          console.warn(`⚠️ 用户已不活动 ${inactiveTime / 1000} 秒，超过阈值 ${inactivityTimeout / 1000} 秒，自动退出`);
          message.warning('由于长时间未操作，您已自动退出登录');
          handleLogout();
          return false;
        }
      }

      return true;
    };

    // 统一处理退出逻辑
    const handleLogout = () => {
      clearAuth();
      setCurrentUser(undefined);
      
      // 清除定时器
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
      }

      // 跳转到登录页
      if (location.pathname.startsWith('/infra')) {
        window.location.href = '/infra/login';
      } else {
        window.location.href = '/login';
      }
    };

    // 立即执行一次检查
    if (!checkAuthStatus()) {
      return;
    }

    // 设置定时器
    const checkTimerRef = { current: null as NodeJS.Timeout | null };
    checkTimerRef.current = setInterval(() => {
      if (!checkAuthStatus()) {
        if (checkTimerRef.current) {
          clearInterval(checkTimerRef.current);
        }
      }
    }, checkInterval);

    // 清理定时器
    return () => {
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
      }
    };
  }, [isPublicPath, location.pathname, setCurrentUser, getConfig]);

  // 检查是否有 token（这是判断是否登录的唯一标准）
  const token = getToken();
  const hasToken = !!token;

  // 使用 useMemo 稳定重定向逻辑，避免无限循环
  const redirectTarget = React.useMemo(() => {
    // ⚠️ 核心逻辑：只有真正已登录（有 token 且 currentUser 存在）时才重定向
    // 如果只有 token 但没有 currentUser，说明可能还在加载中，不重定向
    const isAuthenticated = hasToken && currentUser;

    // 如果是公开页面且已登录，重定向到对应的仪表盘
    if (isPublicPath && isAuthenticated) {
      // 平台超管登录后，如果访问的是登录页，重定向到平台运营看板
      if (isInfraLoginPage && currentUser.is_infra_admin) {
        return '/infra/operation';
      }
      // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘工作台
      if (location.pathname === '/login' && !currentUser.is_infra_admin) {
        return '/system/dashboard/workplace';
      }
    }

    // ⚠️ 核心逻辑：只有没有 token 时才跳转到登录页
    // 有 token = 已登录，允许访问所有页面（包括功能菜单）
    if (!isPublicPath && !hasToken) {
      // 平台级路由重定向到平台登录页
      if (location.pathname.startsWith('/infra')) {
        return '/infra/login';
      }
      // 系统级路由重定向到用户登录页
      return '/login';
    }

    return null;
  }, [isPublicPath, currentUser, isInfraLoginPage, location.pathname, hasToken]);

  // ⚠️ 关键修复：公开页面且无 token 时，直接渲染，跳过 loading/redirect，避免登录页循环加载
  if (isPublicPath && !hasToken) {
    return <>{children}</>;
  }

  const shouldBypassAuth = isMasterDataPath || isDebugPath;
  const shouldShowLoading = !isPublicPath && (loading || isLoading);
  const shouldRedirect = redirectTarget !== null;

  if (shouldBypassAuth) {
    return <>{children}</>;
  }

  if (shouldShowLoading) {
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

  if (shouldRedirect) {
    return <Navigate to={redirectTarget} replace />;
  }

  return <>{children}</>;
});

/**
 * ⚠️ 关键：必须定义在 App 函数外部（模块级别）
 * 若定义在 App 内部，每次 App 重渲染时 React 会认为这是一个全新的组件类型，
 * 导致整个子树卸载并重挂载，引发无限循环。
 */
const AppContent: React.FC = () => {
  const { message } = AntdApp.useApp();
  const touchScreen = useTouchScreen();
  const navigate = useNavigate();

  // 将 message 实例设置到全局，供工具函数使用
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ANTD_MESSAGE__ = message;
    }
  }, [message]);

  // 将 navigate 注入到全局，供 QuickNavigation 等工具在非组件上下文中使用
  React.useEffect(() => {
    setNavigateRef(navigate);
  }, [navigate]);

  // 应用触屏模式样式类
  React.useEffect(() => {
    const rootElement = document.documentElement;
    if (touchScreen.isTouchScreenMode) {
      rootElement.classList.add('touchscreen-mode');
    } else {
      rootElement.classList.remove('touchscreen-mode');
    }
  }, [touchScreen.isTouchScreenMode]);

  const routesElement = React.useMemo(() => <MainRoutes />, []);
  return (
    <ErrorBoundary>
      <AuthGuard>
        {routesElement}
      </AuthGuard>
    </ErrorBoundary>
  );
};

// 主应用组件
export default function App() {

  const currentUser = useGlobalStore((s) => s.currentUser);
  const initFromApi = useThemeStore((s) => s.initFromApi);
  const themeInitialized = useThemeStore((s) => s.initialized);
  const subscribeToSystemTheme = useThemeStore((s) => s.subscribeToSystemTheme);
  const themeMode = useThemeStore((s) => s.theme);

  // 主题初始化（挂载时执行一次）
  useEffect(() => {
    useUserPreferenceStore.getState().rehydrateFromStorage();
    const cachedPrefs = useUserPreferenceStore.getState().preferences;
    if (cachedPrefs?.language) {
      i18n.changeLanguage(cachedPrefs.language).catch(() => {});
    }
    initFromApi();
    loadUserLanguage().catch((err) => {
      console.warn('Failed to load user language during app init:', err);
    });
    // 尽早预取头像 URL，缩短顶栏头像显示延迟
    const userInfo = getUserInfo();
    const avatarUuid = (userInfo as any)?.avatar;
    if (avatarUuid) prefetchAvatarUrl(avatarUuid);
  }, [initFromApi]);

  // 当 userPreferenceStore.preferences 变化时，同步主题到 themeStore（偏好设置页、theme-editor 等通过 updatePreferences 更新后生效）
  useEffect(() => {
    const unsub = useUserPreferenceStore.subscribe((state) => {
      if (state.preferences && Object.keys(state.preferences).length > 0) {
        useThemeStore.getState().syncFromPreferences(state.preferences);
      }
    });
    return unsub;
  }, []);

  // 退出后重新登录时，clearForLogout 会将 initialized 置为 false，
  // 需在用户登录成功后重新拉取主题偏好，无需刷新页面
  useEffect(() => {
    if (currentUser && getToken() && !themeInitialized) {
      initFromApi();
    }
  }, [currentUser, themeInitialized, initFromApi]);

  // 监听系统主题变化（当 theme=auto 时）
  useEffect(() => {
    return subscribeToSystemTheme();
  }, [themeMode, subscribeToSystemTheme]);


  const resolved = useThemeStore((s) => s.resolved);
  const finalThemeConfig = React.useMemo(
    () => ({ algorithm: resolved.algorithm, token: resolved.token }),
    [resolved.algorithm, resolved.token]
  );

  return (
    <ConfigProvider theme={finalThemeConfig}>
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  );
}
