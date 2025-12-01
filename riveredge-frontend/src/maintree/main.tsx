import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './app'
// 导入全局样式（从 tree-stem 引用）
import '../tree-stem/global.less'

// 抑制 findDOMNode 警告（Ant Design 在 React 18 StrictMode 下的已知问题）
// 同时抑制 passive 事件监听器警告（第三方库的已知问题）
// 
// 注意：浏览器直接显示的 [Violation] 警告（如 passive event listener 警告）
// 无法通过拦截 console 来抑制，这些是浏览器性能提示，不影响功能。
// 这些警告主要来自第三方库（如 Univer、Ant Design 等），我们无法直接修改它们的代码。
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
  
  const isPassiveEventListenerWarning = (message: any): boolean => {
    if (typeof message !== 'string') {
      return false;
    }
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('non-passive event listener') ||
      lowerMessage.includes('passive event listener') ||
      lowerMessage.includes('scroll-blocking') ||
      lowerMessage.includes('wheel event') ||
      lowerMessage.includes('touchstart') ||
      lowerMessage.includes('touchmove') ||
      lowerMessage.includes('violation')
    );
  };
  
  console.error = (...args: any[]) => {
    const hasFindDOMNodeWarning = args.some(arg => isFindDOMNodeWarning(arg));
    const hasPassiveWarning = args.some(arg => isPassiveEventListenerWarning(arg));
    if (hasFindDOMNodeWarning || hasPassiveWarning) {
      return;
    }
    originalError.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    const hasFindDOMNodeWarning = args.some(arg => isFindDOMNodeWarning(arg));
    const hasPassiveWarning = args.some(arg => isPassiveEventListenerWarning(arg));
    if (hasFindDOMNodeWarning || hasPassiveWarning) {
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

