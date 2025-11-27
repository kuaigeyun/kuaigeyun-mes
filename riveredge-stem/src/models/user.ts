/**
 * 用户状态管理
 * 
 */

import { useState, useCallback } from 'react';
import { getCurrentUser, CurrentUser } from '@/services/auth';
import { getToken, clearAuth } from '@/utils/auth';

/**
 * 用户状态接口
 */
export interface UserState {
  currentUser?: CurrentUser;
  loading: boolean;
}

/**
 * 用户 Model
 */
export default function useUserModel() {
  const [state, setState] = useState<UserState>({
    currentUser: undefined,
    loading: false,
  });
  
  /**
   * 获取当前用户信息
   */
  const fetchUserInfo = useCallback(async () => {
    // 检查是否有 Token
    if (!getToken()) {
      return;
    }
    
    setState((prev) => ({ ...prev, loading: true }));
    
    try {
      const userInfo = await getCurrentUser();
      setState({
        currentUser: userInfo,
        loading: false,
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      setState({
        currentUser: undefined,
        loading: false,
      });
    }
  }, []);
  
  /**
   * 设置当前用户信息
   * 
   * @param user - 用户信息
   */
  const setCurrentUser = useCallback((user: CurrentUser | undefined) => {
    setState((prev) => ({
      ...prev,
      currentUser: user,
    }));
  }, []);
  
  /**
   * 清除用户信息
   */
  const clearUser = useCallback(() => {
    clearAuth();
    setState({
      currentUser: undefined,
      loading: false,
    });
  }, []);
  
  return {
    ...state,
    fetchUserInfo,
    setCurrentUser,
    clearUser,
  };
}

