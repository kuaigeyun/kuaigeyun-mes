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
import { App as AntdApp, ConfigProvider, Spin } from 'antd';
import { AntdAppBridge } from './utils/antdAppApis';
import PageSkeleton, { PageSkeletonProps } from './components/page-skeleton';
import { PageLoadingFullscreen } from './components/page-loading-lottie';
import { GLOBAL_SPIN_INDICATOR } from './initSpinIndicator';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import zhTW from 'antd/locale/zh_TW';
import jaJP from 'antd/locale/ja_JP';
import viVN from 'antd/locale/vi_VN';
import loLA from './locales/antd/lo_LA';
import {
  getToken,
  clearAuth,
  setUserInfo,
  setTenantId,
  getTenantId,
  isTokenExpired,
  getTokenRemainingTime,
} from './utils/auth';
import { resolveIsInfraSuperAdminSession } from './utils/infraSuperAdminSession';
import { getSessionCurrentUser } from './utils/sessionCurrentUser';
import { buildRestoredUserFromStorage, seedCurrentUserFromAuthStorage } from './utils/restoredUser';
import { isEquivalentCurrentUser } from './utils/currentUserSnapshot';
import { CURRENT_USER_QUERY_ROOT } from './config/sessionQueries';
import { queryClient } from './queryClient';
import { refreshAccessTokenDetailed } from './utils/tokenRefresh';
import { prefetchAvatarUrl } from './utils/avatar';
import { FORM_LAYOUT } from './components/layout-templates/constants';
import { resolveUiFontFamily } from './constants/fonts';
import { useGlobalStore } from './stores';
import { syncLanguageFromPreferences } from './config/i18n';
import { useAppShellReady } from './hooks/useAppShellReady';
import { useCurrentUserQuery } from './hooks/useCurrentUserQuery';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useSiteSettingQuery } from './hooks/useSiteSettingQuery';
import { useUserPreferenceQuery } from './hooks/useUserPreferenceQuery';
import { getDefaultTenantHomePath, useConfigStore } from './stores/configStore';
import { useUserPreferenceStore } from './stores/userPreferenceStore';
import { getPlatformSettingsPublic } from './services/platformSettings';
import { applyFavicon } from './utils/favicon';
import { useThemeStore } from './stores/themeStore';
import {
  ACTIVITY_STORAGE_KEY,
  updateLastActivity,
  getLastActivityTime,
  hasPendingRequests,
  bumpLastActivityBy,
  syncMemoryActivityFromStorage,
} from './utils/activityUtils';
import { useTouchScreen } from './hooks/useTouchScreen';
import { initDocumentStatusCache } from './services/enums';
import { buildLoginRedirectPath, resolveTenantDomainFromUrl } from './utils/tenantDomainAccess';
import { isPlatformAdminLoginPathname, isPlatformInfraPath, isPlatformInfraPublicPath } from './utils/platformScope';
import { isKuaireportSharedBrowsePath } from './utils/kuaireportSharedPath';
import { redirectAfterLogout } from './utils/loginEntry';
// 使用 routes 中的路由配置
import MainRoutes from './routes';
import { AiContextProvider } from './contexts/AiContext';
import ErrorBoundary from './components/error-boundary';

// 权限守卫组件（memo 阻断上层频繁重渲染的级联）
const AuthGuard = React.memo<{ children: React.ReactNode }>(({ children }) => {
  const { t } = useTranslation();
  const { message } = AntdApp.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
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

    seedCurrentUserFromAuthStorage();

    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次，使用 initializedRef 确保只执行一次

  // 公开页面：根路径、登录、初始化向导、分享页等，无需鉴权即可访问
  const pathname = location.pathname;
  const tenantDomainFromPath = resolveTenantDomainFromUrl({ pathname, search: location.search });
  const isKuaireportSharedPath = isKuaireportSharedBrowsePath(pathname);
  const isPublicPath = pathname === '/' ||
    pathname.startsWith('/login') ||
    isPlatformInfraPublicPath(pathname) ||
    pathname.startsWith('/lock-screen') ||
    pathname.startsWith('/init/') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/debug/') ||
    pathname.startsWith('/qrcode/') ||
    isKuaireportSharedPath;
  const isInfraLoginPage = isPlatformAdminLoginPathname(pathname);

  // 分享页凭 URL token 访问，清除残留登录态，避免 401 被全局拦截器重定向到登录页。
  // 登录页/帮助文档等公开路径不得因本地 JWT 过期就清会话：过期访问令牌仍可在刷新窗口内续期。
  React.useLayoutEffect(() => {
    if (isKuaireportSharedPath && getToken()) {
      clearAuth();
      setCurrentUser(undefined);
    }
  }, [isKuaireportSharedPath, setCurrentUser]);

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

  const { data: userData, isLoading, isError, error } = useCurrentUserQuery({
    enabled: shouldFetchUser,
  });

  const tenantId = currentUser?.tenant_id ?? getTenantId();
  useSiteSettingQuery({
    tenantId,
    enabled: shouldFetchUser && !!currentUser && tenantId != null,
  });
  useUserPreferenceQuery({
    tenantId,
    userId: currentUser?.id,
    enabled: shouldFetchUser && !!currentUser && tenantId != null && currentUser.id != null,
  });

  const [infraTimezoneReady, setInfraTimezoneReady] = useState(true);

  // 平台超管可能无租户、拉不到 site-settings：须从平台公开设置补齐 configs.timezone
  useEffect(() => {
    if (isPublicPath || !shouldFetchUser) {
      setInfraTimezoneReady(true);
      return;
    }
    if (!resolveIsInfraSuperAdminSession()) {
      setInfraTimezoneReady(true);
      return;
    }
    const tz = useConfigStore.getState().configs?.timezone;
    if (tz != null && String(tz).trim() !== '') {
      setInfraTimezoneReady(true);
      return;
    }
    let cancelled = false;
    setInfraTimezoneReady(false);
    void useConfigStore
      .getState()
      .ensureTimezoneFromPlatform()
      .finally(() => {
        if (!cancelled) setInfraTimezoneReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isPublicPath, shouldFetchUser, currentUser?.id, tenantId]);

  // 处理用户信息加载成功（唯一数据源：/auth/me）
  useEffect(() => {
    if (!userData) return;
    const prev = useGlobalStore.getState().currentUser;
    const permissionVersionChanged =
      prev?.permission_version != null &&
      userData.permission_version != null &&
      prev.permission_version !== userData.permission_version;
    if (!isEquivalentCurrentUser(prev, userData)) {
      setCurrentUser(userData);
    }
    setUserInfo(userData);
    if (userData.avatar) prefetchAvatarUrl(userData.avatar);
    if (permissionVersionChanged) {
      queryClient.invalidateQueries({ queryKey: [NAVIGATION_MENU_TREE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
      queryClient.invalidateQueries({ queryKey: ['menuCustomLayout'] });
    }
  }, [userData, setCurrentUser]);

  // 用户就绪（无论来自 API 成功还是 localStorage 恢复）后统一预加载枚举缓存；
  // initDocumentStatusCache 内部对 in-flight 请求做单例防并发。
  useEffect(() => {
    if (currentUser && !isPublicPath) {
      initDocumentStatusCache().catch(() => {});
    }
  }, [currentUser, isPublicPath]);

  // 拉取当前用户失败：先尝试静默续期；网络失败保留会话；仅续期被拒或无缓存时才清认证
  useEffect(() => {
    if (!isError) return;
    const token = getToken();
    if (!token) {
      clearAuth();
      setCurrentUser(undefined);
      return;
    }

    let cancelled = false;

    void (async () => {
      const restoredUser = buildRestoredUserFromStorage();
      if (restoredUser) {
        if (!cancelled) {
          setCurrentUser(restoredUser);
          setUserInfo(restoredUser);
          console.warn('获取用户信息失败，使用本地缓存:', error);
        }
        return;
      }

      const refreshResult = await refreshAccessTokenDetailed();
      if (cancelled) return;

      if (refreshResult.ok) {
        await queryClient.invalidateQueries({ queryKey: [CURRENT_USER_QUERY_ROOT] });
        return;
      }

      if (refreshResult.reason === 'network') {
        console.warn('获取用户信息失败且续期网络异常，暂保留会话:', error);
        return;
      }

      const tokenAfterRefresh = getToken();
      if (tokenAfterRefresh && !isTokenExpired(tokenAfterRefresh)) {
        console.warn('获取用户信息失败但访问令牌仍有效，保留会话:', error);
        return;
      }

      clearAuth();
      setCurrentUser(undefined);
    })();

    return () => {
      cancelled = true;
    };
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

  const getConfig = useConfigStore((s) => s.getConfig);
  /** 拆出具体项作依赖，避免 fetchConfigs 更新后定时器仍闭包旧阈值 */
  const tokenCheckIntervalSec = useConfigStore((s) => s.configs['security.token_check_interval']);
  const inactivityTimeoutSec = useConfigStore((s) => s.configs['security.inactivity_timeout']);
  const configInitialized = useConfigStore((s) => s.initialized);

  // 监听用户活动；API 请求由 api.ts 在请求结束（含失败）时强制刷新活动时间
  useEffect(() => {
    if (isPublicPath) return;

    // 进入受保护页面时重置活动时间（清除可能来自上一会话的旧数据）
    updateLastActivity(true);

    /** 捕获阶段：避免表格/画布 stopPropagation 导致操作不刷新活动时间 */
    const onActivity = () => updateLastActivity();
    /** 标签隐藏或窗口失焦期间暂停空闲计时（切到 Excel/微信查数不应累计超时） */
    let pausedSince: number | null =
      document.visibilityState === 'hidden' ||
      (typeof document.hasFocus === 'function' && !document.hasFocus())
        ? Date.now()
        : null;

    const resumeFromPause = () => {
      if (pausedSince != null) {
        bumpLastActivityBy(Date.now() - pausedSince);
        pausedSince = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (pausedSince == null) pausedSince = Date.now();
        return;
      }
      resumeFromPause();
    };

    const onWindowBlur = () => {
      if (pausedSince == null) pausedSince = Date.now();
    };

    const onWindowFocus = () => {
      resumeFromPause();
      updateLastActivity(true);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_STORAGE_KEY || !e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (Number.isFinite(ts)) syncMemoryActivityFromStorage(ts);
    };

    const activityOpts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('pointerdown', onActivity, activityOpts);
    window.addEventListener('pointermove', onActivity, activityOpts);
    window.addEventListener('keydown', onActivity, activityOpts);
    window.addEventListener('keyup', onActivity, activityOpts);
    window.addEventListener('wheel', onActivity, activityOpts);
    window.addEventListener('scroll', onActivity, activityOpts);
    window.addEventListener('touchstart', onActivity, activityOpts);
    window.addEventListener('input', onActivity, activityOpts);
    window.addEventListener('focusin', onActivity, activityOpts);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('pointerdown', onActivity, true);
      window.removeEventListener('pointermove', onActivity, true);
      window.removeEventListener('keydown', onActivity, true);
      window.removeEventListener('keyup', onActivity, true);
      window.removeEventListener('wheel', onActivity, true);
      window.removeEventListener('scroll', onActivity, true);
      window.removeEventListener('touchstart', onActivity, true);
      window.removeEventListener('input', onActivity, true);
      window.removeEventListener('focusin', onActivity, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [isPublicPath]);

  // TOKEN 过期与不活动检测（空闲仅在「页面可见 + 无操作 + 无进行中请求」时累计）
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
      // 非法配置按「禁用」处理，避免回落到 1800s 误踢操作中用户
      if (!Number.isFinite(n) || n < 0) return 0;
      return n * 1000;
    };

    const checkInterval = parseCheckIntervalMs(
      tokenCheckIntervalSec !== undefined ? tokenCheckIntervalSec : getConfig('security.token_check_interval', 60),
    );
    const inactivityTimeout = parseInactivityMs(
      inactivityTimeoutSec !== undefined ? inactivityTimeoutSec : getConfig('security.inactivity_timeout', 0),
    );

    const proactiveRefreshMs = 5 * 60 * 1000;

    // 定时器 ref 需在 handleLogout 之前声明，避免 handleLogout 被首次检查调用时访问未初始化变量
    const checkTimerRef = { current: null as NodeJS.Timeout | null };
    let cancelled = false;

    // 统一处理退出逻辑
    const handleLogout = () => {
      if (cancelled) return;
      clearAuth();
      setCurrentUser(undefined);

      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }

      redirectAfterLogout(navigate);
    };

    // 检查 TOKEN：先主动续期（临近过期），已过期则尝试静默刷新；仅服务端明确拒绝时登出
    const checkAuthStatus = async (): Promise<boolean> => {
      if (cancelled) return false;

      const currentToken = getToken();
      if (!currentToken) {
        return false;
      }

      const remaining = getTokenRemainingTime(currentToken);
      if (remaining > 0 && remaining < proactiveRefreshMs) {
        const proactive = await refreshAccessTokenDetailed();
        if (cancelled) return false;
        // 访问令牌仍有效时续期失败：仅记录，下个周期再试；禁止误踢操作中用户
        if (!proactive.ok && proactive.reason === 'rejected') {
          console.warn('⚠️ TOKEN 临近过期但续期被拒绝，访问令牌仍有效，保留会话待下次续期');
        }
      }

      const tokenAfterProactive = getToken() || currentToken;
      if (isTokenExpired(tokenAfterProactive)) {
        const refreshResult = await refreshAccessTokenDetailed();
        if (cancelled) return false;
        if (!refreshResult.ok) {
          if (refreshResult.reason === 'network') {
            // 操作中网络抖动：不清会话，待下次检查或业务请求再续期
            console.warn('⚠️ TOKEN 已过期但续期网络失败，暂保留会话');
            return true;
          }
          console.warn('⚠️ TOKEN 已过期且续期被拒绝，清除认证信息并跳转到登录页');
          handleLogout();
          return false;
        }
      }

      if (inactivityTimeout > 0 && configInitialized) {
        // 后台标签 / 窗口失焦不累计、不踢出；切回时由 bumpLastActivityBy 暂停补偿
        if (typeof document !== 'undefined') {
          if (document.visibilityState !== 'visible') {
            return true;
          }
          if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
            return true;
          }
        }
        // 有进行中请求 = 操作中，刷新活动并跳过空闲判定
        if (hasPendingRequests()) {
          updateLastActivity(true);
          return true;
        }
        const lastActivityTime = getLastActivityTime();
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > inactivityTimeout) {
          if (cancelled) return false;
          console.warn(`⚠️ 用户已不活动 ${inactiveTime / 1000} 秒，超过阈值 ${inactivityTimeout / 1000} 秒，自动退出`);
          message.warning(t('common.autoLogoutInactivity'));
          handleLogout();
          return false;
        }
      }

      return true;
    };

    const tryProactiveRefreshOnResume = () => {
      void (async () => {
        if (cancelled) {
          return;
        }
        const tok = getToken();
        if (!tok) {
          return;
        }
        const r = getTokenRemainingTime(tok);
        // 回到前台/聚焦：剩余不足或已过期都尝试静默续期，避免「正在用却被过期踢出」
        if (r < proactiveRefreshMs) {
          await refreshAccessTokenDetailed();
        }
      })();
    };

    const onTokenVisibility = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      tryProactiveRefreshOnResume();
    };
    const onTokenWindowFocus = () => {
      tryProactiveRefreshOnResume();
    };
    document.addEventListener('visibilitychange', onTokenVisibility);
    window.addEventListener('focus', onTokenWindowFocus);

    void (async () => {
      const ok = await checkAuthStatus();
      if (cancelled || !ok) {
        return;
      }
      checkTimerRef.current = setInterval(() => {
        void (async () => {
          if (cancelled) return;
          const stillOk = await checkAuthStatus();
          if (cancelled) return;
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
      window.removeEventListener('focus', onTokenWindowFocus);
      if (checkTimerRef.current) {
        window.clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [
    isPublicPath,
    setCurrentUser,
    getConfig,
    t,
    message,
    tokenCheckIntervalSec,
    inactivityTimeoutSec,
    configInitialized,
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
      if (isPlatformInfraPath(location.pathname)) {
        return '/infra/login';
      }
      if (tenantDomainFromPath) {
        return buildLoginRedirectPath();
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
  const shouldWaitInfraTimezone =
    hasToken && !isPublicPath && resolveIsInfraSuperAdminSession() && !infraTimezoneReady;

  if (shouldBypassAuth) {
    return <>{children}</>;
  }

  if (shouldRedirect) {
    return <Navigate to={redirectTarget} replace />;
  }

  if (shouldShowLoading || shouldWaitInfraTimezone) {
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
  const navigate = useNavigate();

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

  const routesElement = React.useMemo(
    () => (
      <AiContextProvider>
        <MainRoutes />
      </AiContextProvider>
    ),
    [],
  );
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
  'lo-LA': loLA,
  'lo': loLA,
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
    const sessionUser = getSessionCurrentUser();
    const avatarUuid = sessionUser?.avatar;
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

  // PC / H5 二分：<1200 已跳 H5；留在 PC 的一律桌面令牌，无中间平板档
  const responsiveThemeConfig = React.useMemo(() => {
    const { algorithm, token } = finalThemeConfig;
    const uiFontFamily = resolveUiFontFamily(i18n.language);
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
        ...(uiFontFamily ? { fontFamily: uiFontFamily } : {}),
        controlOutlineWidth: 0,
        controlOutline: 'transparent',
        paddingContentHorizontal: 16,
        paddingContentVertical: 16,
        padding: 16,
        margin: 16,
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
  }, [finalThemeConfig, i18n.language]);

  const antLocale = React.useMemo(
    () => ANT_LOCALE_MAP[i18n.language] || ANT_LOCALE_MAP[i18n.language?.split('-')[0]] || zhCN,
    [i18n.language]
  );

  // 触屏工位模式用 middle；普通 PC 亦 middle（小屏已交 H5，不再用 small 平板档）
  const componentSize = 'middle' as const;

  return (
    <ConfigProvider 
      theme={responsiveThemeConfig} 
      locale={antLocale}
      componentSize={componentSize}
      spin={{
        indicator: GLOBAL_SPIN_INDICATOR,
        styles: {
          description: { whiteSpace: 'nowrap', maxWidth: 'none', flexShrink: 0 },
        },
      }}
      /** 状态类徽章默认 solid；分类/模式/编组等标识须显式 variant="filled" */
      tag={{ variant: 'solid' }}
      /** Select/TreeSelect 下拉宽度随选项内容扩展，不与触发器等宽（个别页可显式 popupMatchSelectWidth 覆盖） */
      popupMatchSelectWidth={false}
    >
      <AntdApp>
        {/* 无条件挂载：壳层加载阶段的请求错误提示也必须使用带主题的 App 实例 */}
        <AntdAppBridge />
        {appShellReady ? (
          <AppContent touchScreen={touchScreen} />
        ) : (
          <AppShellLoading isDark={resolved.isDark} />
        )}
      </AntdApp>
    </ConfigProvider>
  );
}
