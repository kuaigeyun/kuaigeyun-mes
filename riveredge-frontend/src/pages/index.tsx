/**
 * 首页
 *
 * 重定向到登录页或仪表盘
 *
 * 重要：登录页已统一走主应用 SPA 渲染，未登录时使用 React Router 内部跳转。
 * 这样可避免首屏依赖生产环境对 /login 的反代/静态路由配置，降低白屏风险。
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../utils/auth';
import { getDefaultTenantHomePath } from '../stores/configStore';

export default function IndexPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (getToken()) {
      navigate(getDefaultTenantHomePath());
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return null;
}

