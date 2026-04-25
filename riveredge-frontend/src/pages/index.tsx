/**
 * 首页
 *
 * 重定向到登录页或仪表盘
 *
 * 重要：未登录跳转 /login 必须用 window.location.replace（真正的浏览器导航），
 * 而不是 React Router 的 navigate（SPA 内部跳转）。否则首次访问 / 走主应用 bundle，
 * 用户刷新后浏览器再请求 /login 时 Caddy 命中 @login → 加载独立 login.html (MPA bundle)，
 * 两份不同 bundle 导致"首次正常 刷新异常"。
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../utils/auth';

export default function IndexPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (getToken()) {
      navigate('/system/dashboard/workplace');
    } else {
      window.location.replace('/login');
    }
  }, [navigate]);

  return null;
}

