/**
 * 全局状态管理 Store
 *
 * 使用 Zustand 管理全局状态，包括用户信息、加载状态等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CurrentUser } from '../types/api';
import { clearAuth } from '../utils/auth';
import { useUserPreferenceStore } from './userPreferenceStore';
import { useThemeStore } from './themeStore';

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
   * 锁屏状态
   */
  isLocked: boolean;
  /**
   * 锁屏前的路径
   */
  lockedPath?: string;
  /**
   * 设置当前用户信息
   */
  setCurrentUser: (user?: CurrentUser) => void;
  /**
   * 设置加载状态
   */
  setLoading: (loading: boolean) => void;
  /**
   * 锁定屏幕
   */
  lockScreen: (path?: string) => void;
  /**
   * 解锁屏幕
   */
  unlockScreen: () => void;
  /**
   * 退出登录
   */
  logout: () => void;
  /**
   * 应用菜单版本号（应用启用/停用时递增，用于触发菜单刷新）
   */
  applicationMenuVersion: number;
  incrementApplicationMenuVersion: () => void;
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
      isLocked: false,
      lockedPath: undefined,
      applicationMenuVersion: 0,
      setCurrentUser: (user) => set({ currentUser: user }),
      setLoading: (loading) => set({ loading }),
      lockScreen: (path) => set({ isLocked: true, lockedPath: path }),
      unlockScreen: () => {
        set((state) => {
          const path = state.lockedPath;
          return { isLocked: false, lockedPath: undefined };
        });
      },
      logout: () => {
        clearAuth();
        set({ currentUser: undefined, isLocked: false, lockedPath: undefined });
        // 清空用户偏好和主题缓存，避免下一账户读到当前账户的偏好（账户与租户隔离）
        useUserPreferenceStore.getState().clearForLogout();
        useThemeStore.getState().clearForLogout();
        // ⚠️ 关键修复：不在这里直接跳转，由调用方使用 navigate 进行跳转，避免页面刷新
        // 路由守卫会自动处理重定向到登录页
      },
      incrementApplicationMenuVersion: () =>
        set((s) => ({ applicationMenuVersion: (s.applicationMenuVersion ?? 0) + 1 })),
    }),
    {
      name: 'riveredge-global-store',
      partialize: (state) => ({ 
        currentUser: state.currentUser,
        isLocked: state.isLocked,
        lockedPath: state.lockedPath,
      }),
    }
  )
);
