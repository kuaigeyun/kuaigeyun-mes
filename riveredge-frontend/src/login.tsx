/**
 * 登录页独立入口（MPA）
 *
 * 性能优化：为 /login 提供最小化 bundle，不加载主应用的 App、MainRoutes、AuthGuard 等
 * 登录成功后 window.location.href 跳转主应用，实现首屏快速加载
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCNLocale from './locales/zh-CN.login';
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./pages/login'));
import './pages/login/index.less';

// 登录页最小 i18n：仅加载 zh-CN，不请求后端
i18n.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  debug: false,
  interpolation: { escapeValue: false },
  keySeparator: false,
  nsSeparator: false,
  resources: { 'zh-CN': { translation: zhCNLocale } },
});

// 登录页最小 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

/**
 * 登录成功后跳转主应用（全页面加载）
 * 当 path 不是 /login 时，说明用户已登录成功，需加载主应用
 */
function RedirectToApp() {
  const location = useLocation();
  React.useEffect(() => {
    const target = location.pathname + (location.search || '');
    window.location.href = target || '/';
  }, [location.pathname, location.search]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#666' }}>
      正在跳转...
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  const initialPath = window.location.pathname === '/login' ? '/login' : '/login';
  ReactDOM.createRoot(root).render(
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <App>
          <MemoryRouter initialEntries={[initialPath]} initialIndex={0}>
            <Routes>
              <Route
                path="/login"
                element={
                  <Suspense
                    fallback={
                      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#666' }}>
                        加载中...
                      </div>
                    }
                  >
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<RedirectToApp />} />
            </Routes>
          </MemoryRouter>
        </App>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
