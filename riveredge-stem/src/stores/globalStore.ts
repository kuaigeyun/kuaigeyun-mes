/**
 * 全局状态管理 Store
 * 
 * 使用 Zustand 管理全局状态，包括用户信息、加载状态等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CurrentUser } from '@/types/api';
import { clearAuth } from '@/utils/auth';

/**
 * 全局状态接口
 */
export interface GlobalState {
  /**
   * 当前用户信息
   */
  currentUser?: CurrentUser;
  /**
   * 加载状态
   */
  loading: boolean;
  /**
   * 设置当前用户信息
   */
  setCurrentUser: (user?: CurrentUser) => void;
  /**
   * 设置加载状态
   */
  setLoading: (loading: boolean) => void;
  /**
   * 退出登录
   */
  logout: () => void;
}

/**
 * 全局状态 Store
 * 
 * 使用 Zustand 的 persist 中间件实现状态持久化
 */
export const useGlobalStore = create<GlobalState>()(
  persist(
    (set) => ({
      currentUser: undefined,
      loading: false,
      setCurrentUser: (user) => set({ currentUser: user }),
      setLoading: (loading) => set({ loading }),
      logout: () => {
        clearAuth();
        set({ currentUser: undefined });
        window.location.href = '/login';
      },
    }),
    {
      name: 'riveredge-global-store',
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);

