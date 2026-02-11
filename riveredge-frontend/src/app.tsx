/**
 * RiverEdge SaaS 多组织框架 - 前端应用入口
 *
 * 使用现代化 React 生态技术栈：
 * - React 18.3.1 + TypeScript 5.6.3
 * - React Router DOM 6.26.2 (路由管理)
 * - Ant Design 6.1.0 + Pro Components 2.8.2 (UI组件)
 */

import React, { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { App as AntdApp, Spin, ConfigProvider, theme, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './services/auth';
import { getToken, clearAuth, getUserInfo, setUserInfo, setTenantId, isTokenExpired } from './utils/auth';
import { useGlobalStore } from './stores';
import i18n, { loadUserLanguage } from './config/i18n';
import { getUserPreference, UserPreference } from './services/userPreference';
import { getSiteSetting } from './services/siteSetting';
import { useConfigStore } from './stores/configStore';
import { useUserPreferenceStore } from './stores/userPreferenceStore';
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

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();

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

  // 公开页面（登录页面包含注册功能，通过 Drawer 实现）
  // ⚠️ 关键修复：先定义公开页面判断，避免在 shouldFetchUser 中使用未定义的变量
  const publicPaths = ['/login', '/debug/'];
  // 平台登录页是公开的，但其他平台页面需要登录
  const isInfraLoginPage = location.pathname === '/infra/login';
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path)) || isInfraLoginPage;

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
      // ⚠️ 关键修复：保存完整用户信息到 localStorage，包含 tenant_name（如果后端返回）
      // 注意：如果后端没有返回 tenant_name，需要根据 tenant_id 查询租户信息
      setUserInfo(userData);
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
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // 引入 useConfigStore
  const { fetchConfigs, getConfig, initialized: configInitialized } = useConfigStore();

  // 初始化系统配置
  useEffect(() => {
    if (currentUser && !configInitialized) {
      fetchConfigs();
    }
  }, [currentUser, configInitialized, fetchConfigs]);

  // 用户不活动检测状态
  const ACTIVITY_STORAGE_KEY = 'riveredge_last_activity';
  // 初始化最后活动时间：优先从 localStorage 获取，实现跨标签页同步
  const getStoredActivity = () => {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  };
  const lastActivityRef = React.useRef(getStoredActivity());
  
  // 更新最后活动时间
  const updateActivity = React.useCallback(() => {
    const now = Date.now();
    // 简单的节流：每 5 秒更新一次 localStorage，避免频繁写入性能损耗
    if (now - lastActivityRef.current > 5000) {
      lastActivityRef.current = now;
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
    }
  }, []);

  // 监听用户活动
  useEffect(() => {
    if (isPublicPath) return;

    // 初始化时更新一次
    updateActivity();

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, [isPublicPath, updateActivity]);

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

      // 2. 检查用户不活动超时 (0表示禁用)
      if (inactivityTimeout > 0) {
        // 读取跨标签页的最后活动时间（获取所有标签页中最新的活动时间）
        const storedActivityStr = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        const lastActivityTime = storedActivityStr ? parseInt(storedActivityStr, 10) : lastActivityRef.current;
        
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

  // ⚠️ 关键修复：移除所有条件返回，确保每次渲染都调用相同数量的 Hook
  // 使用状态变量控制渲染内容
  const shouldBypassAuth = isMasterDataPath || isDebugPath;
  const shouldShowLoading = loading || isLoading;
  const shouldRedirect = redirectTarget !== null;

  // 根据状态决定渲染内容
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
};

// 主应用组件
export default function App() {

  const [userPreference, setUserPreference] = useState<UserPreference | null>(null);
  // 主题配置本地存储键名
  const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';

  // 同步从本地存储加载配置
  const loadThemeFromCache = () => {
    try {
      const cached = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
      if (cached) {
         return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached theme config:', e);
    }
    return null;
  };

  const [_siteThemeConfig, setSiteThemeConfig] = useState<{
    colorPrimary?: string;
    borderRadius?: number;
    fontSize?: number;
    compact?: boolean;
    siderBgColor?: string; // 左侧菜单栏背景色（仅浅色模式，支持透明度）
    headerBgColor?: string; // 顶栏背景色（支持透明度）
    tabsBgColor?: string; // 标签栏背景色（支持透明度）
    theme?: string; // 保存的颜色模式
  } | null>(() => loadThemeFromCache());

  const [themeConfig, setThemeConfig] = useState<{
    algorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm | Array<typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm>;
    token: {
      colorPrimary?: string;
      borderRadius?: number;
      fontSize?: number;
    };
  } | null>(() => {
    // 初始状态立即计算，避免闪烁
    const cachedConfig = loadThemeFromCache();
    if (cachedConfig) {
      const userTheme = cachedConfig.theme || 'light'; // 默认为浅色
      
      // 确定基础算法
      let baseAlgorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm = theme.defaultAlgorithm;
      if (userTheme === 'dark') {
        baseAlgorithm = theme.darkAlgorithm;
      } else if (userTheme === 'auto') {
        // 同步检测系统主题
        if (typeof window !== 'undefined' && window.matchMedia) {
           const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
           baseAlgorithm = prefersDark ? theme.darkAlgorithm : theme.defaultAlgorithm;
        }
      }

      // 紧凑模式
      const algorithm = cachedConfig.compact
        ? [baseAlgorithm, theme.compactAlgorithm]
        : baseAlgorithm;

      // Token
      const token = {
        colorPrimary: cachedConfig.colorPrimary || '#1890ff',
        borderRadius: cachedConfig.borderRadius || 6,
        fontSize: cachedConfig.fontSize || 14,
      };

      // 立即设置全局变量，确保子组件渲染时能获取到
      if (typeof window !== 'undefined') {
        const isDark = baseAlgorithm === theme.darkAlgorithm || (Array.isArray(algorithm) && algorithm.includes(theme.darkAlgorithm));
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

        // 只有浅色模式下才设置自定义侧边栏背景
        if (userTheme === 'light' && cachedConfig.siderBgColor && cachedConfig.siderBgColor.trim() !== '') {
          (window as any).__RIVEREDGE_SIDER_BG_COLOR__ = cachedConfig.siderBgColor;
        } else {
           // 确保清理
           delete (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
        }

        if (cachedConfig.headerBgColor && cachedConfig.headerBgColor.trim() !== '') {
          (window as any).__RIVEREDGE_HEADER_BG_COLOR__ = cachedConfig.headerBgColor;
        } else {
           delete (window as any).__RIVEREDGE_HEADER_BG_COLOR__;
        }

        if (cachedConfig.tabsBgColor && cachedConfig.tabsBgColor.trim() !== '') {
          (window as any).__RIVEREDGE_TABS_BG_COLOR__ = cachedConfig.tabsBgColor;
        } else {
           delete (window as any).__RIVEREDGE_TABS_BG_COLOR__;
        }
      }

      return { algorithm, token };
    }
    
    // 默认回退
    return {
      algorithm: theme.defaultAlgorithm,
      token: { colorPrimary: '#1890ff' }
    };
  });

  // 加载站点主题配置（从服务器加载，如果失败则使用缓存）
  const loadSiteTheme = async () => {
    try {
      const cachedThemeConfig = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);

      // 从服务器加载主题配置
      const siteSetting = await getSiteSetting();
      const themeConfig = siteSetting?.settings?.theme_config || {};

      // 如果服务器有配置，使用服务器配置；否则使用缓存配置
      const finalConfig = Object.keys(themeConfig).length > 0 ? themeConfig : (cachedThemeConfig ? JSON.parse(cachedThemeConfig) : {});

      setSiteThemeConfig(finalConfig);

      // 保存到本地存储（临时方案）
      if (Object.keys(finalConfig).length > 0) {
        localStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(finalConfig));
      }

      return finalConfig;
    } catch (error) {
      console.warn('Failed to load site theme:', error);
      // 如果服务器加载失败，尝试使用本地存储
      const cachedThemeConfig = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
      if (cachedThemeConfig) {
        try {
          const parsedConfig = JSON.parse(cachedThemeConfig);
          if (parsedConfig && typeof parsedConfig === 'object') {
            setSiteThemeConfig(parsedConfig);
            return parsedConfig;
          }
        } catch (e) {
          console.warn('Failed to parse cached theme config:', e);
        }
      }
      return null;
    }
  };

  // 应用主题配置（合并用户偏好和站点设置）
  const applyThemeConfig = (
    userThemePreference: string,
    siteTheme: { colorPrimary?: string; borderRadius?: number; fontSize?: number; compact?: boolean; siderBgColor?: string; headerBgColor?: string; tabsBgColor?: string } | null
  ) => {
    // 确定基础算法（用户偏好）
    let baseAlgorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm = theme.defaultAlgorithm;

    if (userThemePreference === 'dark') {
      baseAlgorithm = theme.darkAlgorithm;
    } else if (userThemePreference === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      baseAlgorithm = prefersDark ? theme.darkAlgorithm : theme.defaultAlgorithm;
    } else {
      baseAlgorithm = theme.defaultAlgorithm;
    }

    // 如果站点设置了紧凑模式，组合紧凑算法
    const algorithm = siteTheme?.compact
      ? [baseAlgorithm, theme.compactAlgorithm]
      : baseAlgorithm;

    // 构建 token（优先使用站点设置，否则使用默认值）
    const token: {
      colorPrimary?: string;
      borderRadius?: number;
      fontSize?: number;
    } = {
      colorPrimary: siteTheme?.colorPrimary || '#1890ff',
      borderRadius: siteTheme?.borderRadius || 6,
      fontSize: siteTheme?.fontSize || 14,
    };

    // 立即应用主题配置，不使用过渡动画
    setThemeConfig({ algorithm, token });

    // ⚠️ 关键修复：强制设置文档的 color-scheme，确保滚动条等原生控件颜色正确
    // 解决“明亮模式不受系统暗黑模式影响”以及“暗黑模式下滚动条不白”的问题
    const isDark = baseAlgorithm === theme.darkAlgorithm || (Array.isArray(algorithm) && algorithm.includes(theme.darkAlgorithm));
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    // 设置左侧菜单栏背景色（仅浅色模式支持自定义背景色，支持透明度）
    // 将自定义背景色存储到全局变量，供 BasicLayout 使用
    if (userThemePreference === 'light' && siteTheme?.siderBgColor !== undefined) {
      // 仅在浅色模式下应用自定义背景色
      if (siteTheme.siderBgColor && siteTheme.siderBgColor.trim() !== '') {
        (window as any).__RIVEREDGE_SIDER_BG_COLOR__ = siteTheme.siderBgColor;
      } else {
        // 如果为空字符串，清除自定义背景色（使用默认背景色）
        delete (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
      }
    } else {
      // 深色模式下，清除自定义背景色（使用深色模式的默认背景色）
      delete (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
    }

    // 设置顶栏背景色（支持透明度，浅色和深色模式都支持）
    // 将自定义背景色存储到全局变量，供 BasicLayout 使用
    if (siteTheme?.headerBgColor !== undefined) {
      if (siteTheme.headerBgColor && siteTheme.headerBgColor.trim() !== '') {
        (window as any).__RIVEREDGE_HEADER_BG_COLOR__ = siteTheme.headerBgColor;
      } else {
        // 如果为空字符串，清除自定义背景色（使用默认背景色）
        delete (window as any).__RIVEREDGE_HEADER_BG_COLOR__;
      }
    } else {
      delete (window as any).__RIVEREDGE_HEADER_BG_COLOR__;
    }

    // 设置标签栏背景色（支持透明度，浅色和深色模式都支持）
    // 将自定义背景色存储到全局变量，供 UniTabs 组件使用
    if (siteTheme?.tabsBgColor !== undefined) {
      if (siteTheme.tabsBgColor && siteTheme.tabsBgColor.trim() !== '') {
        (window as any).__RIVEREDGE_TABS_BG_COLOR__ = siteTheme.tabsBgColor;
      } else {
        // 如果为空字符串，清除自定义背景色（使用默认背景色）
        delete (window as any).__RIVEREDGE_TABS_BG_COLOR__;
      }
    } else {
      delete (window as any).__RIVEREDGE_TABS_BG_COLOR__;
    }

    // 强制立即更新 DOM，清除可能的缓存
    requestAnimationFrame(() => {
      // 清除可能的 CSS 变量缓存
      document.documentElement.style.removeProperty('--ant-colorBgLayout');
      document.documentElement.style.removeProperty('--ant-colorBgContainer');
      document.documentElement.style.removeProperty('--ant-colorBgElevated');
      document.documentElement.style.removeProperty('--ant-colorPrimary');
      // 强制重新计算样式，清除浏览器缓存
      void document.documentElement.offsetHeight;
    });
  };

  const currentUser = useGlobalStore((s) => s.currentUser);

  // 初始化时加载用户偏好设置和站点主题配置（挂载时若有 token 则执行）
  useEffect(() => {
    const token = getToken();

    if (token) {
      // 1）先同步从当前账户缓存恢复偏好，首帧即生效，避免换账号后需刷新才生效
      useUserPreferenceStore.getState().rehydrateFromStorage();
      const cachedPrefs = useUserPreferenceStore.getState().preferences;
      if (cachedPrefs?.theme != null || (cachedPrefs?.theme_config && Object.keys(cachedPrefs.theme_config).length > 0)) {
        const userTheme = cachedPrefs.theme || 'light';
        const userThemeConfig = cachedPrefs.theme_config;
        const effectiveTheme = userThemeConfig && typeof userThemeConfig === 'object'
          ? { ...(_siteThemeConfig || {}), ...userThemeConfig }
          : _siteThemeConfig;
        applyThemeConfig(userTheme, effectiveTheme);
      }
      if (cachedPrefs?.language) {
        i18n.changeLanguage(cachedPrefs.language).catch(() => {});
      }

      // 2）后台拉取最新偏好与站点主题，拉取后再应用一次以与服务器一致
      useUserPreferenceStore.getState().fetchPreferences().catch(() => {});

      Promise.all([
        getUserPreference().catch((error) => {
          // 如果是 401 错误，静默忽略（token 可能在其他地方被验证）
          if (error?.response?.status === 401) {
            console.warn('⚠️ 用户偏好设置加载失败（401），跳过设置');
            return null;
          }
          return null;
        }),
        loadSiteTheme().catch(() => null),
      ]).then(([preference, siteTheme]) => {
        if (preference) {
          setUserPreference(preference);
        }

        // 判断是否有用户偏好设置（检查 theme 是否存在）
        const hasUserPreference = preference?.preferences?.theme !== undefined && preference?.preferences?.theme !== null;

        if (hasUserPreference) {
          // 非首次登录：优先使用保存的偏好设置
          const userTheme = preference.preferences.theme;
          // 如果用户偏好是 'auto'，默认使用浅色而不是跟随系统
          const actualTheme = userTheme === 'auto' ? 'light' : userTheme;
          // 合并站点主题与用户偏好中的 theme_config（偏好设置页/主题配置）
          const userThemeConfig = preference.preferences.theme_config;
          const effectiveTheme = userThemeConfig && typeof userThemeConfig === 'object'
            ? { ...(siteTheme || {}), ...userThemeConfig }
            : siteTheme;
          applyThemeConfig(actualTheme, effectiveTheme);
        } else {
          // 首次登录或未做偏好设置：检查本地缓存
          const cachedThemeConfig = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
          if (cachedThemeConfig) {
            try {
              const parsedConfig = JSON.parse(cachedThemeConfig);
              if (parsedConfig && typeof parsedConfig === 'object') {
                // 无偏好设置但有本地缓存：使用本地缓存
                // 从缓存中获取主题模式，如果没有则使用浅色
                const cachedTheme = parsedConfig.theme || 'light';
                const actualTheme = cachedTheme === 'auto' ? 'light' : cachedTheme;
                applyThemeConfig(actualTheme, parsedConfig);
              } else {
                // 缓存格式错误：使用默认主题色+浅色模式
                applyThemeConfig('light', null);
              }
            } catch (e) {
              console.warn('Failed to parse cached theme config:', e);
              // 解析失败：使用默认主题色+浅色模式
              applyThemeConfig('light', null);
            }
          } else {
            // 无偏好设置且无本地缓存：使用默认主题色+浅色模式
            applyThemeConfig('light', null);
          }
        }

        // 加载用户选择的语言（异步，不阻塞主题加载）
        loadUserLanguage().catch((err) => {
          console.warn('Failed to load user language during app init:', err);
        });
      }).catch((error) => {
        console.warn('Failed to load preferences:', error);
        // 如果加载失败，尝试使用本地存储的主题配置
        const cachedThemeConfig = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
        if (cachedThemeConfig) {
          try {
            const fallbackConfig = JSON.parse(cachedThemeConfig);
            if (fallbackConfig && typeof fallbackConfig === 'object') {
              const cachedTheme = fallbackConfig.theme || 'light';
              const actualTheme = cachedTheme === 'auto' ? 'light' : cachedTheme;
              applyThemeConfig(actualTheme, fallbackConfig);
            } else {
              applyThemeConfig('light', null);
            }
          } catch (e) {
            console.warn('Failed to parse cached theme config:', e);
            applyThemeConfig('light', null);
          }
        } else {
          // 无缓存：使用默认主题色+浅色模式
          applyThemeConfig('light', null);
        }
        loadUserLanguage().catch((err) => {
          console.warn('Failed to load user language:', err);
        });
      });
    } else {
      // 未登录时，忽略所有缓存，强制使用默认色+浅色模式
      applyThemeConfig('light', null);
    }
  }, []); // 依赖为空，确保只在挂载时执行

  // 当认证完成（currentUser 就绪）后确保拉取用户偏好，解决首次加载或登录后需刷新才能获取偏好的问题
  useEffect(() => {
    const token = getToken();
    if (!token || !currentUser) return;
    const { initialized } = useUserPreferenceStore.getState();
    if (!initialized) {
      useUserPreferenceStore.getState().rehydrateFromStorage();
      useUserPreferenceStore.getState().fetchPreferences().catch(() => {});
    }
  }, [currentUser]);

  // 监听系统主题变化（当用户偏好为 auto 时）
  useEffect(() => {
    if (userPreference?.preferences?.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const userTheme = e.matches ? 'dark' : 'light';
        // 使用函数式更新，确保获取最新的 siteThemeConfig
        setSiteThemeConfig((currentSiteTheme) => {
          applyThemeConfig(userTheme, currentSiteTheme);
          return currentSiteTheme;
        });
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [userPreference?.preferences?.theme]); // 移除 siteThemeConfig 依赖，避免重复触发

  useEffect(() => {
    const handlePreferenceUpdate = async (_event: CustomEvent) => {
      // 重新加载用户偏好设置
      try {
        const preference = await getUserPreference();
        setUserPreference(preference);

        // 应用新的主题偏好：合并站点主题与用户偏好中的 theme_config
        const userTheme = preference?.preferences?.theme || 'light';
        const userThemeConfig = preference?.preferences?.theme_config;
        setSiteThemeConfig((currentSiteTheme) => {
          const effectiveTheme = userThemeConfig && typeof userThemeConfig === 'object'
            ? { ...currentSiteTheme, ...userThemeConfig }
            : currentSiteTheme;
          applyThemeConfig(userTheme, effectiveTheme);
          return currentSiteTheme;
        });
      } catch (error) {
        console.warn('Failed to reload user preference:', error);
      }
    };

    // 监听站点主题更新事件
    const handleSiteThemeUpdate = async (event: CustomEvent) => {
      const newThemeConfig = (event as CustomEvent).detail?.themeConfig;
      if (newThemeConfig) {
        // 立即更新状态
        setSiteThemeConfig(newThemeConfig);
        // 使用函数式更新 userPreference，确保获取最新值
        setUserPreference((currentPreference) => {
          const userTheme = currentPreference?.preferences?.theme || 'light';
          // 立即应用主题配置，不使用缓存
          applyThemeConfig(userTheme, newThemeConfig);
          return currentPreference;
        });
      } else {
        // 如果没有传递配置，重新加载（不使用缓存）
        const siteTheme = await loadSiteTheme();
        if (siteTheme) {
          setSiteThemeConfig(siteTheme);
          setUserPreference((currentPreference) => {
            const userTheme = currentPreference?.preferences?.theme || 'light';
            applyThemeConfig(userTheme, siteTheme);
            return currentPreference;
          });
        }
      }
    };

    window.addEventListener('userPreferenceUpdated', handlePreferenceUpdate as unknown as EventListener);
    window.addEventListener('siteThemeUpdated', handleSiteThemeUpdate as unknown as EventListener);
    return () => {
      window.removeEventListener('userPreferenceUpdated', handlePreferenceUpdate as unknown as EventListener);
      window.removeEventListener('siteThemeUpdated', handleSiteThemeUpdate as unknown as EventListener);
    };
  }, []); // 移除依赖项，避免重复触发和状态覆盖

  // 如果主题配置未加载，使用默认配置（避免闪烁）
  const finalThemeConfig = themeConfig || {
    algorithm: theme.defaultAlgorithm,
    token: { colorPrimary: '#1890ff' },
  };

  // ⚠️ 关键修复：创建内部组件来使用 App.useApp() hook，设置全局 message 实例
  // 这样可以避免 Ant Design 6.0 的警告："Static function can not consume context like dynamic theme"
  const AppContent: React.FC = () => {
    const { message } = AntdApp.useApp();
    const touchScreen = useTouchScreen();

    // 将 message 实例设置到全局，供工具函数使用
    React.useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__ANTD_MESSAGE__ = message;
      }
    }, [message]);

    // 应用触屏模式样式类
    React.useEffect(() => {
      const rootElement = document.documentElement;
      if (touchScreen.isTouchScreenMode) {
        rootElement.classList.add('touchscreen-mode');
      } else {
        rootElement.classList.remove('touchscreen-mode');
      }
    }, [touchScreen.isTouchScreenMode]);

    return (
      <ErrorBoundary>
        <AuthGuard>
          <MainRoutes />
        </AuthGuard>
      </ErrorBoundary>
    );
  };

  return (
    <ConfigProvider theme={finalThemeConfig}>
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  );
}
