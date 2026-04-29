/**
 * 登录页独立入口（MPA）
 *
 * 性能优化：为 /login 提供最小化 bundle，不加载主应用的 App、MainRoutes、AuthGuard 等
 * 登录成功后 window.location.href 跳转主应用，实现首屏快速加载
 */

import './pages/login/index.less';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { App } from 'antd';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCNLocale from './locales/zh-CN.login';
import enUSLocale from './locales/en-US.login';
import LoginPage from './pages/login';

// 语言检测逻辑
const getInitialLang = () => {
  const saved = localStorage.getItem('i18nextLng');
  if (saved && (saved === 'zh-CN' || saved === 'en-US')) return saved;
  
  const navLang = navigator.language;
  if (navLang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
};

const initialLang = getInitialLang();

// 登录页最小 i18n：加载 zh-CN 和 en-US
i18n.use(initReactI18next).init({
  lng: initialLang,
  fallbackLng: 'zh-CN',
  debug: false,
  interpolation: { escapeValue: false },
  keySeparator: false,
  nsSeparator: false,
  resources: { 
    'zh-CN': { translation: zhCNLocale },
    'en-US': { translation: enUSLocale }
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

function LoginRoot() {
  const [locale, setLocale] = useState(initialLang === 'zh-CN' ? zhCN : enUS);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setLocale(lng === 'zh-CN' ? zhCN : enUS);
      localStorage.setItem('i18nextLng', lng);
    };
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const initialPath = window.location.pathname === '/login' ? '/login' : '/login';

  return (
    <ConfigProvider locale={locale}>
      <App>
        <MemoryRouter initialEntries={[initialPath]} initialIndex={0}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<RedirectToApp />} />
          </Routes>
        </MemoryRouter>
      </App>
    </ConfigProvider>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<LoginRoot />);
}

