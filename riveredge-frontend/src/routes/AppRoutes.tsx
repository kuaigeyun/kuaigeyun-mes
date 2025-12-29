/**
 * 应用路由组件
 *
 * 负责异步加载业务应用路由，与系统核心路由完全隔离
 * 应用加载失败不会影响系统核心功能的正常使用
 */

import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { getInstalledApplicationList } from '../services/application';
import { loadPlugin } from '../utils/pluginLoader';
import type { Application } from '../services/application';
import BasicLayout from '../layouts/BasicLayout';
import PageSkeleton from '../components/page-skeleton';

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

// 加载中组件 - 使用骨架屏
const LoadingFallback: React.FC = () => <PageSkeleton />;

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
        setLoading(false);
        return;
      }


      // 获取已安装且启用的应用列表
      const applications = await getInstalledApplicationList({ is_active: true });

      // 异步加载所有应用路由
      const routes: React.ReactNode[] = [];
      const loadPromises = applications.map(async (app: Application) => {
        if (app.entry_point && app.route_path) {
          try {
            const pluginRouteConfigs = await loadPlugin(app);


            // 为每个路由配置创建Route组件
            for (const routeConfig of pluginRouteConfigs) {
              // ⚠️ 重要：由于 AppRoutes 已经被 /apps/* 匹配，这里需要使用相对路径
              // routeConfig.path 是 /apps/master-data，需要去掉 /apps/ 前缀
              const relativePath = routeConfig.path.startsWith('/apps/') 
                ? routeConfig.path.replace('/apps/', '') 
                : routeConfig.path;
              
              routes.push(
                <Route
                  key={`app-${app.code}-${relativePath}`}
                  path={`${relativePath}/*`}
                  element={
                    <BasicLayout>
                      <Suspense fallback={
                        <div style={{ padding: '20px', background: '#fff3cd', border: '1px solid #ffeaa7', margin: '10px' }}>
                          <h3>🔄 正在加载应用: {app.name}</h3>
                          <p>路由: {routeConfig.path}</p>
                          <p>时间: {new Date().toLocaleTimeString()}</p>
                        </div>
                      }>
                        <AppErrorBoundary appName={app.name}>
                          {(() => {

                            // 尝试直接渲染组件，看是否能触发错误
                            try {
                              return React.createElement(routeConfig.component);
                            } catch (renderError) {
                              console.error(`❌ 组件渲染失败:`, renderError);
                              throw renderError;
                            }
                          })()}
                        </AppErrorBoundary>
                      </Suspense>
                    </BasicLayout>
                  }
                />
              );
            }

          } catch (appError) {
            console.error(`❌ 应用 ${app.code} 加载失败:`, appError);
            // 单个应用加载失败不影响其他应用
            // 可以在这里添加错误统计或上报逻辑
          }
        }
      });

      // 等待所有应用加载完成
      await Promise.all(loadPromises);

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

  if (appRoutes.length === 0) {
    console.warn('⚠️ AppRoutes: 没有应用路由，可能应用未加载');
    return (
      <div style={{ padding: '20px', background: '#fff3cd', border: '1px solid #ffeaa7' }}>
        <h3>⚠️ 没有可用的应用路由</h3>
        <p>当前路径: {window.location.pathname}</p>
        <p>已加载的应用路由数: {appRoutes.length}</p>
        <p>如果这是应用路径，请检查应用是否正确安装和启用</p>
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
