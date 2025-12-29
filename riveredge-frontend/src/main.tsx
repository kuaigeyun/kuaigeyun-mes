import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './app'
import './global.less'

// ⚠️ 关键修复：同步导入i18n配置，确保应用启动前语言包已加载
// 这解决了菜单标题显示英文的问题
import './config/i18n'

// Ant Design 6.0 已移除 findDOMNode 兼容逻辑，不再需要抑制警告

// ⚠️ 关键修复：全局错误处理，捕获未处理的错误，避免应用崩溃
if (typeof window !== 'undefined') {
  // 捕获未处理的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    console.error('⚠️ 未处理的 Promise 错误:', event.reason);
    // 阻止默认的错误处理（避免浏览器控制台显示错误）
    event.preventDefault();
  });

  // 捕获全局 JavaScript 错误
  window.addEventListener('error', (event) => {
    console.error('⚠️ 全局 JavaScript 错误:', event.error);
    // 阻止默认的错误处理
    event.preventDefault();
  });
}

// 创建 Query Client（配置智能重试和错误处理）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ⚠️ 智能重试策略：针对后端重启等临时错误进行重试
      retry: (failureCount, error: any) => {
        // 401 错误不重试（认证问题）
        if (error?.response?.status === 401) {
          return false;
        }
        // 400 错误不重试（请求参数错误）
        if (error?.response?.status === 400) {
          return false;
        }
        // 500 错误不重试（服务器错误，避免频繁重试导致崩溃）
        if (error?.response?.status === 500) {
          return false;
        }
        // 网络错误或后端重启错误（502, 503, 504）最多重试 2 次
        const isNetworkError = error?.message?.includes('fetch') || 
                               error?.message?.includes('NetworkError') ||
                               error?.message?.includes('Failed to fetch');
        const isServerError = [502, 503, 504].includes(error?.response?.status);
        
        if (isNetworkError || isServerError) {
          return failureCount < 2; // 最多重试 2 次，减少重试次数
        }
        
        // 其他错误不重试（避免频繁重试导致崩溃）
        return false;
      },
      // 重试延迟（指数退避）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // 减少最大延迟时间
      refetchOnWindowFocus: false, // ⚠️ 关键修复：禁用窗口聚焦时自动刷新，避免频繁请求
      refetchOnReconnect: false, // ⚠️ 关键修复：禁用网络重连时自动刷新
      refetchOnMount: true, // 组件挂载时刷新
      staleTime: 5 * 60 * 1000, // 5分钟
      // ⚠️ 全局错误处理（静默处理，避免重复提示和崩溃）
      throwOnError: false,
      // ⚠️ 关键修复：禁用错误时的自动重试，避免无限循环
      retryOnMount: false,
    },
    mutations: {
      // Mutation 错误处理
      retry: (failureCount, error: any) => {
        // Mutation 操作不自动重试（避免重复提交）
        return false;
      },
      throwOnError: false,
    },
  },
  // ⚠️ 关键修复：增加错误处理，避免未捕获的错误导致应用崩溃
  logger: {
    log: (...args) => {
      // 开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        // 开发环境日志（可选）
        if (import.meta.env.DEV) {
          console.log('[React Query]', ...args);
        }
      }
    },
    warn: (...args) => {
      console.warn('[React Query]', ...args);
    },
    error: (...args) => {
      // 错误日志但不抛出异常，避免导致应用崩溃
      console.error('[React Query]', ...args);
    },
  },
})

// ⚠️ 关键修复：开发环境禁用 StrictMode，避免双重渲染导致的问题
// StrictMode 会导致组件渲染两次，可能触发一些副作用导致崩溃
const AppWrapper = process.env.NODE_ENV === 'development' ? (
  <ConfigProvider locale={zhCN}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </ConfigProvider>
) : (
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')!).render(AppWrapper)

