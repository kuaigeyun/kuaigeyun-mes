/**
 * 首页
 * 
 * 重定向到登录页或仪表盘
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@/utils/auth';

/**
 * 首页组件
 */
export default function IndexPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // 如果已登录，跳转到仪表盘；否则跳转到登录页
    if (isAuthenticated()) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [navigate]);
  
  return null;
}

