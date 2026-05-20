/**
 * 应用路由组件
 *
 * 负责异步加载业务应用路由，与系统核心路由完全隔离
 * 应用加载失败不会影响系统核心功能的正常使用
 *
 * 性能优化：按需加载
 * - Spin 占位仅在获取应用列表（getInstalledApplicationList）时显示
 * - 各应用插件在用户访问对应路由时才加载（React.lazy），与系统级页面体验一致
 *
 * ⚠️ 注意：BasicLayout 已提升到 MainRoutes 层级，这里不再包裹 BasicLayout
 */

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getInstalledApplicationList, scanPlugins } from '../services/application';
import { loadPlugin } from '../utils/pluginLoader';
import { getToken, getTenantId } from '../utils/auth';
import type { Application } from '../services/application';
import PageSkeleton from '../components/page-skeleton';
import ProUpgradePrompt from '../components/pro-upgrade-prompt';

const INSTALLED_APPS_QUERY_KEY = ['installedApplications', { is_active: true }] as const;

/**
 * 延迟显示的 Fallback 组件
 * 初始 delayMs 内渲染 null，超时后才显示 Spin，避免快速加载时的闪烁
 */
const DelayedFallback: React.FC<{ delayMs?: number }> = ({ delayMs = 0 }) => {
  const [show, setShow] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return show ? <PageSkeleton variant="content" /> : null;
};

/** 为单个应用创建按需加载的懒组件（仅在该路由被访问时才加载 chunk） */
function createLazyApp(app: Application) {
  return React.lazy(() =>
    loadPlugin(app).then((routes) => ({ default: routes[0]?.component ?? (() => null) }))
  );
}

// 应用组件错误边界
const AppErrorBoundary: React.FC<{ children: React.ReactNode; appName: string }> = ({ children, appName }) => {
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  React.useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error(`❌ AppErrorBoundary: 捕获到错误 in ${appName}:`, event.error);
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, [appName]);

  if (hasError) {
    return (
      <div style={{ padding: '20px', background: '#fff2f0', border: '1px solid #ffccc7' }}>
        <h3 style={{ color: '#cf1322' }}>❌ {t('appRoutes.loadError')}</h3>
        <p><strong>{t('appRoutes.app')}:</strong> {appName}</p>
        <p><strong>{t('appRoutes.error')}:</strong> {error?.message || t('common.unknownError')}</p>
        <details>
          <summary style={{ cursor: 'pointer', color: '#1890ff' }}>🔍 {t('appRoutes.viewDetails')}</summary>
          <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {error?.stack || 'No stack trace'}
          </pre>
        </details>
        <Button
          style={{ marginTop: '10px' }}
          onClick={() => {
            setHasError(false);
            setError(null);
            window.location.reload();
          }}
        >
          {t('appRoutes.reload')}
        </Button>
      </div>
    );
  }

  try {
    return <>{children}</>;
  } catch (renderError) {
    console.error(`❌ AppErrorBoundary: 渲染错误 in ${appName}:`, renderError);
    return (
      <div style={{ padding: '20px', background: '#fff2f0', border: '1px solid #ffccc7' }}>
        <h3 style={{ color: '#cf1322' }}>❌ {t('appRoutes.renderError')}</h3>
        <p><strong>{t('appRoutes.app')}:</strong> {appName}</p>
        <p><strong>{t('appRoutes.error')}:</strong> {renderError instanceof Error ? renderError.message : String(renderError)}</p>
      </div>
    );
  }
};

// 加载中组件 - 延迟显示骨架屏，快速加载时不闪烁
const LoadingFallback: React.FC = () => <DelayedFallback />;

// 应用加载错误组件
const AppLoadError: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div style={{
      padding: '24px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px'
    }}>
      <Alert
        message={t('appRoutes.loadFailed')}
        description={
          <div>
            <p>{t('appRoutes.loadFailedDesc')}</p>
            <p style={{ marginTop: 8, color: '#666' }}>
              {t('appRoutes.errorDetail')}: {error.message}
            </p>
          </div>
        }
        type="warning"
        showIcon
        action={
          <Button size="small" onClick={onRetry}>
            {t('appRoutes.retryLoad')}
          </Button>
        }
      />
    </div>
  );
};

/**
 * 应用路由组件
 *
 * 异步加载业务应用，确保应用层问题不影响系统层
 */
const AppRoutes: React.FC = () => {
  const { t } = useTranslation();
  const [hasScanned, setHasScanned] = useState(false);

  // 缓存每个 app 的 React.lazy 实例，防止 useMemo 重算时重建 lazy 组件导致子树重新挂载
  const lazyAppsCache = useRef<Map<string, React.ComponentType>>(new Map());

  // 检查用户是否已登录（同步读取，首帧即知；不再走 dynamic import 导致多一帧 Loading）
  const token = getToken() ?? null;
  const tenantId = getTenantId()?.toString() ?? null;
  const isAuthenticated = !!(token && tenantId);

  const { data: applications = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: INSTALLED_APPS_QUERY_KEY,
    queryFn: async () => {
      let apps = await getInstalledApplicationList({ is_active: true });
      if (apps.length === 0 && !hasScanned) {
        try {
          await scanPlugins();
          setHasScanned(true);
          apps = await getInstalledApplicationList({ is_active: true });
        } catch (scanError: any) {
          console.error('❌ [AppRoutes] 扫描应用失败:', scanError);
          setHasScanned(true);
        }
      }
      return apps;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // 同步计算路由节点（useMemo 在渲染阶段执行，applications 可用时路由立即就绪，
  // 彻底消除 useEffect 异步延迟造成的"空路由"竞态窗口，无需任何延迟兜底）
  const appRoutes = useMemo<React.ReactNode[]>(() => {
    if (!applications.length) return [];
    const routes: React.ReactNode[] = [];
    for (const app of applications) {
      if (!app.entry_point || !app.route_path) {
        console.warn(`⚠️ [AppRoutes] 应用 ${app.code} 缺少 entry_point 或 route_path`);
        continue;
      }
      const relativePath = app.route_path.startsWith('/apps/')
        ? app.route_path.replace('/apps/', '')
        : app.route_path;
      // 复用已有的 lazy 实例，避免重新创建导致子树重新挂载
      if (!lazyAppsCache.current.has(app.code)) {
        lazyAppsCache.current.set(app.code, createLazyApp(app));
      }
      const LazyApp = lazyAppsCache.current.get(app.code)!;
      const isProLocked = app.is_pro && !app.can_access;
      routes.push(
        <Route
          key={`app-${app.code}-${relativePath}`}
          path={`${relativePath}/*`}
          element={
            isProLocked ? (
              <ProUpgradePrompt appName={app.name} appCode={app.code} />
            ) : (
              <Suspense fallback={<DelayedFallback />}>
                <AppErrorBoundary appName={app.name}>
                  <LazyApp />
                </AppErrorBoundary>
              </Suspense>
            )
          }
        />
      );
    }
    return routes;
  }, [applications]);

  // 加载中状态（应用列表加载中）
  if (isAuthenticated && loading) {
    return <LoadingFallback />;
  }

  // 加载出错状态
  if (error) {
    return <AppLoadError error={error as Error} onRetry={() => refetch()} />;
  }

  // 如果用户未登录，不渲染任何内容（应用路由应该在登录后才可用）
  if (!isAuthenticated) {
    return null;
  }

  if (appRoutes.length === 0) {
    // 仅在 applications 有数据但路由为空时警告（可能是配置问题）；applications 为空时可能是加载中
    if (applications.length > 0) {
      console.warn('⚠️ [AppRoutes] 没有应用路由，可能应用未加载或配置异常');
    }
    return (
      <div style={{ padding: '20px', background: '#fff3cd', border: '1px solid #ffeaa7' }}>
        <h3>⚠️ {t('appRoutes.noAppRoutes')}</h3>
        <p>{t('appRoutes.currentPath')}: {window.location.pathname}</p>
        <p>{t('appRoutes.loadedRoutesCount')}: {appRoutes.length}</p>
        <p>{t('appRoutes.noAppRoutesHint')}</p>
        <div style={{ marginTop: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
          <p><strong>{t('appRoutes.troubleshootTitle')}：</strong></p>
          <ol style={{ marginLeft: '20px' }}>
            <li>{t('appRoutes.troubleshoot1')}</li>
            <li>{t('appRoutes.troubleshoot2')}</li>
            <li>{t('appRoutes.troubleshoot3')}</li>
            <li>{t('appRoutes.troubleshoot4')}</li>
            <li>{t('appRoutes.troubleshoot5')}</li>
          </ol>
          <p style={{ marginTop: '12px', color: '#666', fontSize: '12px' }}>
            💡 {t('appRoutes.troubleshootTip')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {appRoutes}
    </Routes>
  );
};

export default AppRoutes;
