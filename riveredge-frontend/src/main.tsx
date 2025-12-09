import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './app'
import './global.less'

// Ant Design 6.0 已移除 findDOMNode 兼容逻辑，不再需要抑制警告

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
        // 网络错误或后端重启错误（502, 503, 504）最多重试 3 次
        const isNetworkError = error?.message?.includes('fetch') || 
                               error?.message?.includes('NetworkError') ||
                               error?.message?.includes('Failed to fetch');
        const isServerError = [502, 503, 504].includes(error?.response?.status);
        
        if (isNetworkError || isServerError) {
          return failureCount < 3; // 最多重试 3 次
        }
        
        // 其他错误最多重试 1 次
        return failureCount < 1;
      },
      // 重试延迟（指数退避）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5分钟
      // 全局错误处理（静默处理，避免重复提示）
      throwOnError: false,
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
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
)

