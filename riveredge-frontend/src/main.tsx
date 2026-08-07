import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './app'
import './global.less'
import './styles/theme-plain.less'
import { useGlobalStore } from './stores/globalStore'
import { defaultQueryOptions } from './config/reactQuery'
import { seedCurrentUserFromAuthStorage } from './utils/restoredUser'
import './initSpinIndicator'
import './config/dayjs'

// ⚠️ 抑制 Three.js / R3F 已知的不兼容警告 (THREE.Clock 弃用)
if (typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Please use THREE.Timer instead.')) {
      return;
    }
    originalWarn(...args);
  };
}

if (typeof window !== 'undefined') {
  import('./utils/performance').then(({ performanceMonitor, ImageLazyLoader }) => {
    ImageLazyLoader.init();
    window.addEventListener('load', () => {
      const metrics = performanceMonitor.getMetrics();
      if (metrics.firstContentfulPaint && import.meta.env.DEV) {
        console.log(`✅ 首屏加载时间: ${metrics.firstContentfulPaint.toFixed(2)}ms`);
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('⚠️ 未处理的 Promise 错误:', event.reason);
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    // 资源加载失败 / 跨域脚本：event.error 常为 null，不是可恢复的业务异常
    if (!event.error) {
      if (import.meta.env.DEV) {
        const target = event.target;
        const targetDesc =
          target instanceof HTMLElement
            ? `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}`
            : '';
        console.warn(
          '⚠️ 非 JS 异常或匿名脚本错误:',
          event.message || '(no message)',
          event.filename || targetDesc || event.target,
        );
      }
      return;
    }
    console.error('⚠️ 全局 JavaScript 错误:', event.error);
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...defaultQueryOptions,
    },
    mutations: {
      retry: () => false,
      throwOnError: false,
    },
  },
})

const AppWrapper = import.meta.env.DEV ? (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
) : (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

async function mountApp() {
  try {
    await useGlobalStore.persist.rehydrate()
  } catch {
    // 持久化损坏时不阻塞挂载
  }
  seedCurrentUserFromAuthStorage()

  const { prepareInitialLanguageBundle } = await import('./config/i18n')
  await prepareInitialLanguageBundle()

  ReactDOM.createRoot(document.getElementById('root')!).render(AppWrapper)
}

void mountApp()
