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
import { getToken, clearAuth, getUserInfo, setUserInfo } from './utils/auth';
import { useGlobalStore } from './stores';
import { loadUserLanguage } from './config/i18n';
import { getUserPreference, UserPreference } from './services/userPreference';
import { getSiteSetting } from './services/siteSetting';
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
          is_infra_admin: savedUserInfo.user_type === 'infra_superadmin' || savedUserInfo.is_infra_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
          tenant_name: savedUserInfo.tenant_name, // ⚠️ 关键修复：恢复租户名称
        };
        setCurrentUser(restoredUser);
        // ⚠️ 关键修复：确保恢复的用户信息也保存到 localStorage
        setUserInfo(restoredUser);
      }
    }
    
    // 标记为已初始化，避免重复执行
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次，使用 initializedRef 确保只执行一次

  // 公开页面（登录页面包含注册功能，通过 Drawer 实现）
  // ⚠️ 关键修复：先定义公开页面判断，避免在 shouldFetchUser 中使用未定义的变量
  const publicPaths = ['/login'];
  // 平台登录页是公开的，但其他平台页面需要登录
  const isPlatformLoginPage = location.pathname === '/platform' || location.pathname === '/infra/login';
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path)) || isPlatformLoginPage;

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

  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: shouldFetchUser,
    retry: false,
    onSuccess: (data) => {
      if (data) {
        setCurrentUser(data);
        // ⚠️ 关键修复：保存完整用户信息到 localStorage，包含 tenant_name（如果后端返回）
        // 注意：如果后端没有返回 tenant_name，需要根据 tenant_id 查询租户信息
        setUserInfo(data);
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
    },
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

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
      if (isPlatformLoginPage && currentUser.is_infra_admin) {
        return '/infra/operation';
      }
      // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘
      if (location.pathname === '/login' && !currentUser.is_infra_admin) {
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
  const [siteThemeConfig, setSiteThemeConfig] = useState<{
    colorPrimary?: string;
    borderRadius?: number;
    fontSize?: number;
    compact?: boolean;
    siderBgColor?: string; // 左侧菜单栏背景色（仅浅色模式）
  } | null>(null);
  const [themeConfig, setThemeConfig] = useState<{
    algorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm | Array<typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm>;
    token: {
      colorPrimary?: string;
      borderRadius?: number;
      fontSize?: number;
    };
  } | null>(null); // 初始为 null，等待主题配置加载完成后再应用

  // 主题配置本地存储键名（临时方案，后续会做偏好设置）
  const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';

  // 加载站点主题配置（优先从本地存储读取，然后从服务器加载）
  const loadSiteTheme = async () => {
    try {
      // 先尝试从本地存储读取（临时方案）
      const cachedThemeConfig = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
      if (cachedThemeConfig) {
        try {
          const parsedConfig = JSON.parse(cachedThemeConfig);
          if (parsedConfig && typeof parsedConfig === 'object') {
            setSiteThemeConfig(parsedConfig);
            // 继续从服务器加载，但先使用缓存值
          }
        } catch (e) {
          console.warn('Failed to parse cached theme config:', e);
        }
      }

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
    siteTheme: { colorPrimary?: string; borderRadius?: number; fontSize?: number; compact?: boolean; siderBgColor?: string } | null
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
    
    // 设置左侧菜单栏背景色（仅浅色模式支持自定义背景色）
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

  // 初始化时加载用户偏好设置和站点主题配置
  useEffect(() => {
    const token = getToken();
    
    if (token) {
      // 并行加载用户偏好设置和站点主题配置
      Promise.all([
        getUserPreference().catch(() => null),
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
          // 使用站点主题配置（可能包含自定义主题色等）
          applyThemeConfig(actualTheme, siteTheme);
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
        
        // 加载用户选择的语言
        return loadUserLanguage();
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
  }, []);

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

  // 监听用户偏好更新事件
  useEffect(() => {
    const handlePreferenceUpdate = async (event: CustomEvent) => {
      // 重新加载用户偏好设置
      try {
        const preference = await getUserPreference();
        setUserPreference(preference);
        
        // 应用新的主题偏好（使用最新的 siteThemeConfig）
        const userTheme = preference?.preferences?.theme || 'light';
        // 使用函数式更新，确保获取最新的 siteThemeConfig
        setSiteThemeConfig((currentSiteTheme) => {
          applyThemeConfig(userTheme, currentSiteTheme);
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
    
    window.addEventListener('userPreferenceUpdated', handlePreferenceUpdate as EventListener);
    window.addEventListener('siteThemeUpdated', handleSiteThemeUpdate as EventListener);
    return () => {
      window.removeEventListener('userPreferenceUpdated', handlePreferenceUpdate as EventListener);
      window.removeEventListener('siteThemeUpdated', handleSiteThemeUpdate as EventListener);
    };
  }, []); // 移除依赖项，避免重复触发和状态覆盖

  // 如果主题配置未加载，使用默认配置（避免闪烁）
  const finalThemeConfig = themeConfig || {
    algorithm: theme.defaultAlgorithm,
    token: { colorPrimary: '#1890ff' },
  };

  return (
    <ConfigProvider theme={finalThemeConfig}>
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
