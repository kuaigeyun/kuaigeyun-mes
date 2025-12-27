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

      console.log('🔄 开始加载业务应用...');

      // 获取已安装且启用的应用列表
      const applications = await getInstalledApplicationList({ is_active: true });

      console.log(`📦 发现 ${applications.length} 个已安装应用:`,
        applications.map(app => ({
          code: app.code,
          name: app.name,
          entry_point: app.entry_point,
          route_path: app.route_path,
          is_active: app.is_active,
          is_installed: app.is_installed,
        }))
      );

      // 异步加载所有应用路由
      const routes: React.ReactNode[] = [];
      const loadPromises = applications.map(async (app: Application) => {
        if (app.entry_point && app.route_path) {
          try {
            console.log(`🔄 正在加载应用: ${app.code}`, {
              entry_point: app.entry_point,
              route_path: app.route_path,
            });

            const pluginRouteConfigs = await loadPlugin(app);

            console.log(`✅ 应用 ${app.code} 加载成功:`, pluginRouteConfigs);

            // 为每个路由配置创建Route组件
            for (const routeConfig of pluginRouteConfigs) {
              routes.push(
                <Route
                  key={`app-${app.code}-${routeConfig.path}`}
                  path={`${routeConfig.path}/*`}
                  element={
                    <BasicLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <routeConfig.component />
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

      console.log(`🎉 应用加载完成，共加载 ${routes.length} 个路由`);
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
  return (
    <Routes>
      {appRoutes}
    </Routes>
  );
};

export default AppRoutes;
