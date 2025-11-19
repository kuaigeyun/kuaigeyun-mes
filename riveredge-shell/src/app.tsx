/**
 * 应用入口文件
 * 
 * 使用自定义状态管理：getInitialState 和权限控制
 */

import React from 'react';
import { App } from 'antd';
import { getCurrentUser } from '@/services/auth';
import { CurrentUser } from '@/types/api';
import { getToken, clearAuth } from '@/utils/auth';

/**
 * 获取初始状态
 * 
 * 自定义状态管理：在应用启动时获取用户信息
 * 如果 Token 存在，尝试获取用户信息；否则返回空状态
 */
export async function getInitialState(): Promise<{ currentUser?: CurrentUser }> {
  // 如果是登录页或注册页，不获取用户信息
  const { pathname } = window.location;
  if (pathname === '/login' || pathname === '/register') {
    return {};
  }

  // 检查是否有 Token
  const token = getToken();
  if (!token) {
    return {};
  }

  // 尝试获取用户信息
  try {
    const currentUser = await getCurrentUser();
    return { currentUser };
  } catch (error) {
    // Token 无效，清除认证信息
    clearAuth();
    // 如果不在登录页，跳转到登录页
    if (pathname !== '/login') {
      window.location.href = '/login';
    }
    return {};
  }
}

/**
 * 根容器配置
 *
 * 使用 Ant Design App 组件包裹应用，解决 message 静态函数警告
 */
export function rootContainer(lastRootContainer: React.ReactElement) {
  return <App>{lastRootContainer}</App>;
}
