/**
 * 应用路由组件
 *
 * 负责异步加载业务应用路由，与系统核心路由完全隔离
 * 应用加载失败不会影响系统核心功能的正常使用
 *
 * 性能优化：按需加载
 * - 骨架屏仅在获取应用列表（getInstalledApplicationList）时显示
 * - 各应用插件在用户访问对应路由时才加载（React.lazy），与系统级页面体验一致
 *
 * ⚠️ 注意：BasicLayout 已提升到 MainRoutes 层级，这里不再包裹 BasicLayout
 */

import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { getInstalledApplicationList, scanPlugins } from '../services/application';
import { loadPlugin } from '../utils/pluginLoader';
import type { Application } from '../services/application';
import PageSkeleton from '../components/page-skeleton';

/**
 * 延迟显示的 Fallback 组件
 * 初始 delayMs 内渲染 null，超时后才显示骨架屏，避免快速加载时的闪烁
 */
const DelayedFallback: React.FC<{ delayMs?: number }> = ({ delayMs = 200 }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return show ? <PageSkeleton /> : null;
};

/** 为单个应用创建按需加载的懒组件（仅在该路由被访问时才加载 chunk） */
function createLazyApp(app: Application) {
  return React.lazy(() =>
    loadPlugin(app).then((routes) => ({ default: routes[0]?.component ?? (() => null) }))
  );
}

// 应用组件错误边界
const AppErrorBoundary: React.FC<{ children: React.ReactNode; appName: string }> = ({ children, appName }) => {
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
        <h3 style={{ color: '#cf1322' }}>❌ 应用加载错误</h3>
        <p><strong>应用:</strong> {appName}</p>
        <p><strong>错误:</strong> {error?.message || '未知错误'}</p>
        <details>
          <summary style={{ cursor: 'pointer', color: '#1890ff' }}>🔍 查看错误详情</summary>
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
          重新加载
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
        <h3 style={{ color: '#cf1322' }}>❌ 应用渲染错误</h3>
        <p><strong>应用:</strong> {appName}</p>
        <p><strong>错误:</strong> {renderError instanceof Error ? renderError.message : String(renderError)}</p>
      </div>
    );
  }
};

// 加载中组件 - 延迟显示骨架屏，快速加载时不闪烁
const LoadingFallback: React.FC = () => <DelayedFallback />;

// 应用加载错误组件
const AppLoadError: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => (
  <div style={{
    padding: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px'
  }}>
    <Alert
      message="应用加载失败"
      description={
        <div>
          <p>业务应用加载过程中出现错误，但这不影响系统核心功能的正常使用。</p>
          <p style={{ marginTop: 8, color: '#666' }}>
            错误详情: {error.message}
          </p>
        </div>
      }
      type="warning"
      showIcon
      action={
        <Button size="small" onClick={onRetry}>
          重试加载
        </Button>
      }
    />
  </div>
);

/**
 * 应用路由组件
 *
 * 异步加载业务应用，确保应用层问题不影响系统层
 */
const AppRoutes: React.FC = () => {

  const [appRoutes, setAppRoutes] = useState<React.ReactNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadApps = async () => {
    try {
      setLoading(true);
      setError(null);

      // 检查用户是否已登录
      const { getToken, getTenantId } = await import('../utils/auth');
      const token = getToken();
      const tenantId = getTenantId();

      // 如果用户未登录或没有组织上下文，不加载应用
      if (!token || !tenantId) {
        console.log('⚠️ [AppRoutes] 用户未登录或没有组织上下文，跳过应用加载', { hasToken: !!token, hasTenantId: !!tenantId });
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);


      // 获取已安装且启用的应用列表
      let applications = await getInstalledApplicationList({ is_active: true });
      // console.log('📦 [AppRoutes] 获取到的应用列表:', applications.length, applications.map(a => ({ code: a.code, name: a.name, entry_point: a.entry_point, route_path: a.route_path })));

      // 如果应用列表为空且尚未扫描过，尝试扫描并注册应用
      if (applications.length === 0 && !hasScanned) {
        // console.log('🔄 [AppRoutes] 应用列表为空，尝试扫描并注册应用...');
        try {
          const scannedApps = await scanPlugins();
          // console.log('✅ [AppRoutes] 扫描完成，发现应用:', scannedApps.length, scannedApps.map(a => ({ code: a.code, name: a.name, is_installed: a.is_installed, is_active: a.is_active })));
          setHasScanned(true);
          
          // 重新获取已安装且启用的应用列表
          applications = await getInstalledApplicationList({ is_active: true });
          // console.log('📦 [AppRoutes] 重新获取应用列表:', applications.length);
        } catch (scanError: any) {
          console.error('❌ [AppRoutes] 扫描应用失败:', scanError);
          // 扫描失败不影响后续流程，继续使用空列表
          setHasScanned(true);
        }
      }

      // 按需加载：仅根据应用列表创建路由，各应用在首次访问时才加载 chunk
      const routes: React.ReactNode[] = [];
      for (const app of applications) {
        if (!app.entry_point || !app.route_path) {
          console.warn(`⚠️ [AppRoutes] 应用 ${app.code} 缺少 entry_point 或 route_path`);
          continue;
        }
        const relativePath = app.route_path.startsWith('/apps/')
          ? app.route_path.replace('/apps/', '')
          : app.route_path;
        const LazyApp = createLazyApp(app);
        routes.push(
          <Route
            key={`app-${app.code}-${relativePath}`}
            path={`${relativePath}/*`}
            element={
              <Suspense fallback={<DelayedFallback />}>
                <AppErrorBoundary appName={app.name}>
                  <LazyApp />
                </AppErrorBoundary>
              </Suspense>
            }
          />
        );
      }
      setAppRoutes(routes);
      setLoading(false);

    } catch (err) {
      console.error('❌ 应用加载过程出现严重错误:', err);
      setError(err as Error);
      setLoading(false);
    }
  };

  // 组件挂载时加载应用
  useEffect(() => {
    loadApps();
  }, []);

  // 加载中状态
  if (loading) {
    return <LoadingFallback />;
  }

  // 加载出错状态
  if (error) {
    return <AppLoadError error={error} onRetry={loadApps} />;
  }

  // 正常状态：渲染应用路由

  // 如果用户未登录，不显示"没有应用路由"的警告
  if (!isAuthenticated) {
    // 用户未登录时，不渲染任何内容（应用路由应该在登录后才可用）
    return null;
  }

  if (appRoutes.length === 0) {
    console.warn('⚠️ [AppRoutes] 没有应用路由，可能应用未加载');
    return (
      <div style={{ padding: '20px', background: '#fff3cd', border: '1px solid #ffeaa7' }}>
        <h3>⚠️ 没有可用的应用路由</h3>
        <p>当前路径: {window.location.pathname}</p>
        <p>已加载的应用路由数: {appRoutes.length}</p>
        <p>如果这是应用路径，请检查应用是否正确安装和启用</p>
        <div style={{ marginTop: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
          <p><strong>排查步骤：</strong></p>
          <ol style={{ marginLeft: '20px' }}>
            <li>打开浏览器控制台（F12），查看是否有错误信息</li>
            <li>访问"系统管理 → 应用管理"页面，点击"扫描应用"按钮，扫描并注册应用</li>
            <li>确保应用已安装（is_installed = true）且已启用（is_active = true）</li>
            <li>确认应用的 <code>entry_point</code> 和 <code>route_path</code> 配置正确</li>
            <li>查看控制台中的 <code>📦 [AppRoutes]</code> 和 <code>🔍 [pluginLoader]</code> 日志</li>
          </ol>
          <p style={{ marginTop: '12px', color: '#666', fontSize: '12px' }}>
            💡 提示：系统已自动尝试扫描应用。如果仍然没有应用，请手动在"应用管理"页面扫描应用。
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
