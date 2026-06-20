/**
 * RiverEdge SaaS 多组织框架 - 前端应用入口
 *
 * 使用现代化 React 生态技术栈：
 * - React 18.3.1 + TypeScript 5.6.3
 * - React Router DOM 6.26.2 (路由管理)
 * - Ant Design 6.1.0 + Pro Components 2.8.2 (UI组件)
 */

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setNavigateRef } from './utils/navigation';
import { App as AntdApp, ConfigProvider, message, Spin } from 'antd';
import PageSkeleton, { PageSkeletonProps } from './components/page-skeleton';
import { PageLoadingFullscreen } from './components/page-loading-lottie';
import { GLOBAL_SPIN_INDICATOR } from './initSpinIndicator';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import zhTW from 'antd/locale/zh_TW';
import jaJP from 'antd/locale/ja_JP';
import viVN from 'antd/locale/vi_VN';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './services/auth';
import { getCurrentInfraSuperAdmin } from './services/infraAdmin';
import { getToken, clearAuth, getUserInfo, setUserInfo, setTenantId, getTenantId, isTokenExpired, getTokenRemainingTime, isInfraSuperAdminUser, isInfraSuperAdminFromToken } from './utils/auth';
import { buildRestoredUserFromStorage } from './utils/restoredUser';
import { refreshAccessTokenSilently } from './utils/tokenRefresh';
import { prefetchAvatarUrl } from './utils/avatar';
import { FORM_LAYOUT } from './components/layout-templates/constants';
import { ENGLISH_UI_FONT_FAMILY } from './constants/fonts';
import { useGlobalStore } from './stores';
import { syncLanguageFromPreferences } from './config/i18n';
import { useAppShellReady } from './hooks/useAppShellReady';
import { getDefaultTenantHomePath, useConfigStore } from './stores/configStore';
import { useUserPreferenceStore } from './stores/userPreferenceStore';
import { getPlatformSettingsPublic } from './services/platformSettings';
import { applyFavicon } from './utils/favicon';
import { useThemeStore } from './stores/themeStore';
import { updateLastActivity, getLastActivityTime, hasPendingRequests } from './utils/activityUtils';
import { useTouchScreen } from './hooks/useTouchScreen';
import { initDocumentStatusCache } from './services/enums';
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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
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
    const restoredUser = buildRestoredUserFromStorage();

    if ((token || restoredUser) && !currentUser && restoredUser) {
      setCurrentUser(restoredUser);
      setUserInfo(restoredUser);
      if (restoredUser.tenant_id != null) {
        setTenantId(restoredUser.tenant_id);
      }
    }

    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次，使用 initializedRef 确保只执行一次

  // 公开页面：根路径、登录、初始化向导等，无需鉴权即可访问
  const pathname = location.pathname;
  const resolveTenantDomainFromPathname = (path: string): string | null => {
    const segments = path.split('/').filter(Boolean);
    if (!segments.length) return null;
    const reserved = new Set([
      'login',
      'infra',
      'apps',
      'system',
      'personal',
      'init',
      'lock-screen',
      'docs',
      'debug',
      'qrcode',
    ]);
    if (!reserved.has(segments[0])) return segments[0].toLowerCase();
    if (segments[0] === 'login' && segments[1] && !reserved.has(segments[1])) return segments[1].toLowerCase();
    return null;
  };
  const tenantDomainFromPath = resolveTenantDomainFromPathname(pathname);
  const isPublicPath = pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname === '/infra/login' ||
    pathname.startsWith('/lock-screen') ||
    pathname.startsWith('/init/') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/debug/') ||
    pathname.startsWith('/qrcode/');
  const isInfraLoginPage = pathname === '/infra/login';

  // ⚠️ 修复：公开页面若存在过期 token，立即清除，避免触发需认证的请求导致短暂错误提示（如 "Token缺失"）
  // 使用 useLayoutEffect 在首屏绘制前同步执行，减少闪烁
  React.useLayoutEffect(() => {
    if (isPublicPath) {
      const token = getToken();
      if (token && isTokenExpired(token)) {
        clearAuth();
        setCurrentUser(undefined);
      }
    }
  }, [isPublicPath, setCurrentUser]);

  // 使用 useMemo 计算是否应该获取用户信息，避免重复计算
  // ⚠️ 关键修复：在公开页面（如登录页）不应该尝试获取用户信息，避免后端未运行时出现连接错误
  const shouldFetchUser = React.useMemo(() => {
    const token = getToken();
    if (isPublicPath) {
      return false;
    }
    // 有 token 即拉取 /auth/me，避免 persist 中的 permissions 在角色授权后长期过期
    return !!token;
  }, [isPublicPath]);

  const isInfraSuperAdmin = isInfraSuperAdminUser(getUserInfo()) || isInfraSuperAdminFromToken();

  const { data: userData, isLoading, isError, error } = useQuery({
    queryKey: ['currentUser', isInfraSuperAdmin],
    queryFn: async () => {
      if (isInfraSuperAdmin) {
        const infraUser = await getCurrentInfraSuperAdmin();
        const tenantId = getTenantId();
        return {
          id: infraUser.id,
          uuid: infraUser.uuid,
          username: infraUser.username,
          email: infraUser.email,
          full_name: infraUser.full_name,
          avatar: infraUser.avatar,
          is_infra_admin: true,
          is_tenant_admin: false,
          tenant_id: tenantId ?? undefined,
          user_type: 'infra_superadmin' as const,
        };
      }
      return getCurrentUser();
    },
    enabled: shouldFetchUser,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // 处理用户信息加载成功（唯一数据源：/auth/me）
  useEffect(() => {
    if (userData) {
      setCurrentUser(userData);
      setUserInfo(userData);
      if (userData.avatar) prefetchAvatarUrl(userData.avatar);
    }
  }, [userData, setCurrentUser]);

  // 用户就绪（无论来自 API 成功还是 localStorage 恢复）后统一预加载枚举缓存；
  // initDocumentStatusCache 内部对 in-flight 请求做单例防并发。
  useEffect(() => {
    if (currentUser && !isPublicPath) {
      initDocumentStatusCache().catch(() => {});
    }
  }, [currentUser, isPublicPath]);

  // 拉取当前用户失败的兜底：优先从 localStorage 恢复；否则退出到登录页
  useEffect(() => {
    if (!isError) return;
    const token = getToken();
    if (!token) {
      clearAuth();
      setCurrentUser(undefined);
      return;
    }
    const restoredUser = buildRestoredUserFromStorage();
    if (restoredUser) {
      setCurrentUser(restoredUser);
      setUserInfo(restoredUser);
      console.warn('获取用户信息失败，使用本地缓存:', error);
    } else {
      clearAuth();
      setCurrentUser(undefined);
    }
  }, [isError, error, setCurrentUser]);

  useEffect(() => {
    // 公开页面不拉取用户信息，直接清除 loading，避免登录页循环加载
    if (isPublicPath) {
      setLoading(false);
      return;
    }
    // 登录后 store/localStorage 已有用户时，/auth/me 后台刷新不阻塞 UI
    if (currentUser && isLoading) {
      return;
    }
    setLoading(isLoading);
  }, [isLoading, isPublicPath, setLoading, currentUser]);

  // 引入 useConfigStore
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);
  const getConfig = useConfigStore((s) => s.getConfig);
  /** 拆出具体项作依赖，避免 fetchConfigs 更新后定时器仍闭包旧阈值 */
  const tokenCheckIntervalSec = useConfigStore((s) => s.configs['security.token_check_interval']);
  const inactivityTimeoutSec = useConfigStore((s) => s.configs['security.inactivity_timeout']);
  const tenantId = getTenantId();
  /** 记录上次已拉取站点配置的租户：切换租户时必须 fetchConfigs(true)，避免 initialized 短路沿用上一租户内存 */
  const lastSiteSettingTenantRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!currentUser || !tenantId || isPublicPath) return;
    const prev = lastSiteSettingTenantRef.current;
    const tenantChanged = prev !== tenantId;
    lastSiteSettingTenantRef.current = tenantId;
    fetchConfigs(tenantChanged);
  }, [currentUser, tenantId, isPublicPath, fetchConfigs]);

  // 监听用户活动；API 请求由 api.ts 在请求结束（含失败）时强制刷新活动时间
  useEffect(() => {
    if (isPublicPath) return;

    // 进入受保护页面时重置活动时间（清除可能来自上一会话的旧数据）
    updateLastActivity(true);

    const onActivity = () => updateLastActivity();
    const onVisible = () => {
      if (document.visibilityState === 'visible') updateLastActivity(true);
    };

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('touchstart', onActivity);
      document.removeEventListener('visibilitychange', onVisible);
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

    const parseCheckIntervalMs = (raw: unknown): number => {
      const n = Number(raw);
      const sec = !Number.isFinite(n) ? 60 : Math.max(5, Math.min(3600, n));
      return sec * 1000;
    };
    const parseInactivityMs = (raw: unknown): number => {
      const n = Number(raw);
      if (raw === 0 || n === 0) return 0;
      if (!Number.isFinite(n) || n < 0) return 1800 * 1000;
      return n * 1000;
    };

    const checkInterval = parseCheckIntervalMs(
      tokenCheckIntervalSec !== undefined ? tokenCheckIntervalSec : getConfig('security.token_check_interval', 60),
    );
    const inactivityTimeout = parseInactivityMs(
      inactivityTimeoutSec !== undefined ? inactivityTimeoutSec : getConfig('security.inactivity_timeout', 1800),
    );

    const proactiveRefreshMs = 5 * 60 * 1000;

    // 定时器 ref 需在 handleLogout 之前声明，避免 handleLogout 被首次检查调用时访问未初始化变量
    const checkTimerRef = { current: null as NodeJS.Timeout | null };

    // 检查 TOKEN：先主动续期（临近过期），已过期则尝试静默刷新（与后端 grace 对齐），失败再登出
    const checkAuthStatus = async (): Promise<boolean> => {
      const currentToken = getToken();
      if (!currentToken) {
        return false;
      }

      const remaining = getTokenRemainingTime(currentToken);
      if (remaining > 0 && remaining < proactiveRefreshMs) {
        await refreshAccessTokenSilently();
      }

      const tokenAfterProactive = getToken() || currentToken;
      if (isTokenExpired(tokenAfterProactive)) {
        const ok = await refreshAccessTokenSilently();
        if (!ok) {
          console.warn('⚠️ TOKEN 已过期且无法续期，清除认证信息并跳转到登录页');
          handleLogout();
          return false;
        }
      }

      if (inactivityTimeout > 0) {
        if (hasPendingRequests()) {
          return true;
        }
        const lastActivityTime = getLastActivityTime();
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > inactivityTimeout) {
          console.warn(`⚠️ 用户已不活动 ${inactiveTime / 1000} 秒，超过阈值 ${inactivityTimeout / 1000} 秒，自动退出`);
          message.warning(t('common.autoLogoutInactivity'));
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

      // SPA 内部跳转登录页（避免 dev 下全页 /login → login.html MPA 缺 Provider 白屏）
      if (location.pathname.startsWith('/infra')) {
        navigate('/infra/login', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    };

    let cancelled = false;

    const onTokenVisibility = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void (async () => {
        if (cancelled) {
          return;
        }
        const tok = getToken();
        if (!tok) {
          return;
        }
        const r = getTokenRemainingTime(tok);
        if (r > 0 && r < proactiveRefreshMs) {
          await refreshAccessTokenSilently();
        }
      })();
    };
    document.addEventListener('visibilitychange', onTokenVisibility);

    void (async () => {
      const ok = await checkAuthStatus();
      if (cancelled || !ok) {
        return;
      }
      checkTimerRef.current = setInterval(() => {
        void (async () => {
          const stillOk = await checkAuthStatus();
          if (!stillOk && checkTimerRef.current) {
            clearInterval(checkTimerRef.current);
            checkTimerRef.current = null;
          }
        })();
      }, checkInterval);
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onTokenVisibility);
      if (checkTimerRef.current) {
        window.clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [
    isPublicPath,
    location.pathname,
    setCurrentUser,
    getConfig,
    t,
    tokenCheckIntervalSec,
    inactivityTimeoutSec,
    navigate,
  ]);

  // 检查是否有 token（这是判断是否登录的唯一标准）
  const token = getToken();
  const hasToken = !!token;

  // 使用 useMemo 稳定重定向逻辑，避免无限循环
  const redirectTarget = useMemo(() => {
    // ⚠️ 核心逻辑：只有真正已登录（有 token 且 currentUser 存在）时才重定向
    // 如果只有 token 但没有 currentUser，说明可能还在加载中，不重定向
    const isAuthenticated = hasToken && currentUser;

    // 如果是公开页面且已登录，重定向到对应的仪表盘
    if (isPublicPath && isAuthenticated) {
      // 平台超管登录后，如果访问的是登录页，重定向到平台运营看板
      if (isInfraLoginPage && currentUser.is_infra_admin) {
        return '/infra/operation';
      }
      // 普通用户已登录仍访问登录页：立刻落本地默认首页（与 Git 原逻辑一致，不等待 effective-home）
      if (location.pathname === '/login' && !currentUser.is_infra_admin) {
        return getDefaultTenantHomePath();
      }
    }

    // ⚠️ 核心逻辑：只有没有 token 时才跳转到登录页
    // 有 token = 已登录，允许访问所有页面（包括功能菜单）
    if (!isPublicPath && !hasToken) {
      // 平台级路由重定向到平台登录页
      if (location.pathname.startsWith('/infra')) {
        return '/infra/login';
      }
      if (tenantDomainFromPath) {
        return `/login?tenant_domain=${encodeURIComponent(tenantDomainFromPath)}`;
      }
      // 系统级路由重定向到用户登录页
      return '/login';
    }

    return null;
  }, [isPublicPath, currentUser, isInfraLoginPage, location.pathname, hasToken, tenantDomainFromPath]);

  // ⚠️ 关键修复：公开页面且无 token 时，直接渲染，跳过 loading/redirect，避免登录页循环加载
  if (isPublicPath && !hasToken) {
    return <>{children}</>;
  }

  const shouldBypassAuth = isMasterDataPath || isDebugPath;
  const hasAuthenticatedUser = currentUser || buildRestoredUserFromStorage();
  const shouldShowLoading =
    hasToken && !isPublicPath && !hasAuthenticatedUser && (loading || isLoading);
  const shouldRedirect = redirectTarget !== null;

  if (shouldBypassAuth) {
    return <>{children}</>;
  }

  if (shouldRedirect) {
    return <Navigate to={redirectTarget} replace />;
  }

  if (shouldShowLoading) {
    return <DelayedFallback delayMs={0} fullHeight />;
  }

  return (
    <Suspense fallback={<DelayedFallback variant="content" delayMs={200} />}>
      {children}
    </Suspense>
  );
});

/**
 * 延迟加载的 Spin / Lottie 包装器（fullHeight 为全屏 Lottie）
 * 针对首屏和应用切入点优化
 */
const DelayedFallback: React.FC<{
  variant?: PageSkeletonProps['variant'];
  delayMs?: number;
  fullHeight?: boolean;
}> = ({
  variant = 'content',
  delayMs = 150,
  fullHeight = false,
}) => {
  const [show, setShow] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  if (!show) return null;

  if (fullHeight) {
    return <PageLoadingFullscreen />;
  }

  return <PageSkeleton variant={variant} />;
};

/**
 * ⚠️ 关键：必须定义在 App 函数外部（模块级别）
 * 若定义在 App 内部，每次 App 重渲染时 React 会认为这是一个全新的组件类型，
 * 导致整个子树卸载并重挂载，引发无限循环。
 */
/** 主题与语言就绪前的全屏 Spin，避免英文界面先渲染中文文案 */
const AppShellLoading: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDark ? '#141414' : '#f5f5f5',
    }}
  >
    <Spin indicator={GLOBAL_SPIN_INDICATOR} size="large" />
  </div>
);

const AppContent: React.FC<{ touchScreen: any }> = ({ touchScreen }) => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();

  // 将 message 实例设置到全局，供工具函数使用
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ANTD_MESSAGE__ = message;
    }
  }, [message]);

  // 将 navigate 注入到全局，供 QuickNavigation 等工具在非组件上下文中使用
  React.useEffect(() => {
    setNavigateRef(navigate as any);
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

  // 应用平台 Favicon（从平台设置加载）
  React.useEffect(() => {
    getPlatformSettingsPublic()
      .then((settings) => applyFavicon(settings?.favicon))
      .catch(() => applyFavicon(undefined));
  }, []);

  const routesElement = React.useMemo(() => <MainRoutes />, []);
  return (
    <ErrorBoundary>
      <AuthGuard>
        {routesElement}
      </AuthGuard>
    </ErrorBoundary>
  );
};

// Ant Design 语言包映射（按 i18n 语言代码）
const ANT_LOCALE_MAP: Record<string, typeof zhCN> = {
  'zh-CN': zhCN,
  'zh': zhCN,
  'zh-Hant': zhTW,
  'en-US': enUS,
  'en': enUS,
  'ja-JP': jaJP,
  'ja': jaJP,
  'vi-VN': viVN,
  'vi': viVN,
};

// 主应用组件
export default function App() {
  const { i18n } = useTranslation();
  const touchScreen = useTouchScreen();

  // 移除 index.html 静态首屏占位（旧 #app-loading / data-app-first-paint），避免与内层 Spin 叠显或长期不卸
  useEffect(() => {
    document.getElementById('app-loading')?.remove();
    document.querySelector('[data-app-first-paint]')?.remove();
  }, []);

  const appShellReady = useAppShellReady();
  const subscribeToSystemTheme = useThemeStore((s) => s.subscribeToSystemTheme);
  const themeMode = useThemeStore((s) => s.theme);

  // 壳层就绪后预取头像 URL，缩短顶栏头像显示延迟
  useEffect(() => {
    if (!appShellReady) return;
    const userInfo = getUserInfo();
    const avatarUuid = (userInfo as any)?.avatar;
    if (avatarUuid) prefetchAvatarUrl(avatarUuid);
  }, [appShellReady]);

  // 当 language 偏好变化时同步 i18n（与 theme 订阅策略一致）
  useEffect(() => {
    const languageSig = (prefs: Record<string, unknown> | undefined) =>
      typeof prefs?.language === 'string' ? prefs.language : '';
    let lastSig = languageSig(useUserPreferenceStore.getState().preferences as Record<string, unknown>);
    const unsub = useUserPreferenceStore.subscribe((state) => {
      const prefs = state.preferences;
      if (!prefs || typeof prefs !== 'object' || Object.keys(prefs).length === 0) return;
      const next = languageSig(prefs as Record<string, unknown>);
      if (next === lastSig) return;
      lastSig = next;
      syncLanguageFromPreferences(prefs as Record<string, unknown>).catch((err) => {
        console.warn('Failed to sync language from preferences:', err);
      });
    });
    return unsub;
  }, []);

  // 当「主题相关」偏好变化时同步 themeStore。勿在 ui.tables 等变更时触发：UniTable 列持久化会频繁 updatePreferences，
  // 若此处每次都 syncFromPreferences（内部会请求 site-settings），会与 user-preferences 交替形成请求风暴。
  useEffect(() => {
    const themeSig = (prefs: Record<string, unknown> | undefined) =>
      JSON.stringify({
        theme: prefs?.theme,
        theme_config: prefs?.theme_config,
      });
    let lastSig = themeSig(useUserPreferenceStore.getState().preferences as Record<string, unknown>);
    const unsub = useUserPreferenceStore.subscribe((state) => {
      const prefs = state.preferences;
      if (!prefs || typeof prefs !== 'object' || Object.keys(prefs).length === 0) return;
      const next = themeSig(prefs as Record<string, unknown>);
      if (next === lastSig) return;
      lastSig = next;
      useThemeStore.getState().syncFromPreferences(prefs);
    });
    return unsub;
  }, []);

  // 监听系统主题变化（当 theme=auto 时）
  useEffect(() => {
    return subscribeToSystemTheme();
  }, [themeMode, subscribeToSystemTheme]);


  const resolved = useThemeStore((s) => s.resolved);
  const finalThemeConfig = React.useMemo(() => {
    const plainSemanticTokens =
      resolved.themeStyle === 'plain'
        ? {
            // 简约模式保留基础语义色，避免徽章/状态提示全部灰化后不可辨识
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: resolved.token.colorPrimary ?? '#1677ff',
          }
        : {};
    return {
      algorithm: resolved.algorithm,
      token: { ...resolved.token, ...plainSemanticTokens },
    };
  }, [resolved.algorithm, resolved.isDark, resolved.themeStyle, resolved.token]);

  // 响应式布局优化：针对小屏设备（平板/手机）自动缩小组件尺寸和边距
  const [screenSize, setScreenSize] = React.useState({
    isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
    isTablet: typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const responsiveThemeConfig = React.useMemo(() => {
    const { algorithm, token } = finalThemeConfig;
    const isSmall = screenSize.isMobile || screenSize.isTablet;
    const isEnglishLocale = i18n.language?.startsWith('en');
    /** 与 @ant-design/pro-layout 侧栏 collapsedWidth=64 一致。默认 Menu 令牌的 collapsedWidth 常为 2*controlHeightLG(≈80)，
     * 与 64px 侧栏不同宽时，inline-collapsed 用「百分比 padding」的居中在错误宽度上计算，整列会表现成贴左。 */
    const proLayoutSiderCollapsedWidth = 64;

    const noFocusHalo = {
      activeShadow: 'none',
      errorActiveShadow: 'none',
      warningActiveShadow: 'none',
    } as const;

    return {
      algorithm,
      token: {
        ...token,
        ...(isEnglishLocale ? { fontFamily: ENGLISH_UI_FONT_FAMILY } : {}),
        // 全局去掉控件聚焦外圈光晕（保留边框色变化）
        controlOutlineWidth: 0,
        controlOutline: 'transparent',
        // 缩小内容区边距
        paddingContentHorizontal: isSmall ? 10 : 16,
        paddingContentVertical: isSmall ? 10 : 16,
        // 针对手机端进一步微调基础间距
        padding: isSmall ? 12 : 16,
        margin: isSmall ? 12 : 16,
      },
      components: {
        Menu: {
          collapsedWidth: proLayoutSiderCollapsedWidth,
        },
        Input: noFocusHalo,
        InputNumber: noFocusHalo,
        Select: {
          activeOutlineColor: 'transparent',
        },
        DatePicker: noFocusHalo,
        Cascader: {
          activeOutlineColor: 'transparent',
        },
        TreeSelect: {
          activeOutlineColor: 'transparent',
        },
        Form: {
          itemMarginBottom: FORM_LAYOUT.ITEM_MARGIN_BOTTOM,
        },
      },
    };
  }, [finalThemeConfig, screenSize, i18n.language]);

  const antLocale = React.useMemo(
    () => ANT_LOCALE_MAP[i18n.language] || ANT_LOCALE_MAP[i18n.language?.split('-')[0]] || zhCN,
    [i18n.language]
  );

  // 触屏模式下，即使是手机也建议使用 middle 尺寸，配合 CSS 优化确保触控精准
  // 仅在非触屏模式的小屏（如 PC 缩放窗口）才使用 small 以获得最大内容密度
  const componentSize = touchScreen.isTouchScreenMode ? 'middle' : (screenSize.isMobile ? 'small' : 'middle');

  return (
    <ConfigProvider 
      theme={responsiveThemeConfig} 
      locale={antLocale}
      componentSize={componentSize}
      spin={{ indicator: GLOBAL_SPIN_INDICATOR }}
    >
      <AntdApp>
        {appShellReady ? (
          <AppContent touchScreen={touchScreen} />
        ) : (
          <AppShellLoading isDark={resolved.isDark} />
        )}
      </AntdApp>
    </ConfigProvider>
  );
}
