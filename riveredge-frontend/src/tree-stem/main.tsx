import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './app'
import './global.less'

// 抑制 findDOMNode 警告（Ant Design 在 React 18 StrictMode 下的已知问题）
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const isFindDOMNodeWarning = (message: any): boolean => {
    if (typeof message !== 'string') {
      return false;
    }
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('finddomnode') ||
      lowerMessage.includes('finddomnode is deprecated') ||
      lowerMessage.includes('warning: finddomnode') ||
      lowerMessage.includes('finddomnode was passed')
    );
  };
  
  console.error = (...args: any[]) => {
    const hasFindDOMNodeWarning = args.some(arg => isFindDOMNodeWarning(arg));
    if (hasFindDOMNodeWarning) {
      return;
    }
    originalError.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    const hasFindDOMNodeWarning = args.some(arg => isFindDOMNodeWarning(arg));
    if (hasFindDOMNodeWarning) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

// 创建 Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5分钟
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

