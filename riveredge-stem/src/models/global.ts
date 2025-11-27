/**
 * 全局状态管理
 * 
 */

import { useState, useCallback } from 'react';

/**
 * 主题类型
 */
export type ThemeType = 'light' | 'dark';

/**
 * 全局状态接口
 */
export interface GlobalState {
  theme: ThemeType;
  collapsed: boolean;
}

/**
 * 全局 Model
 */
export default function useGlobalModel() {
  const [state, setState] = useState<GlobalState>({
    theme: 'light',
    collapsed: false,
  });
  
  /**
   * 切换主题
   */
  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  }, []);
  
  /**
   * 设置主题
   * 
   * @param theme - 主题类型
   */
  const setTheme = useCallback((theme: ThemeType) => {
    setState((prev) => ({
      ...prev,
      theme,
    }));
  }, []);
  
  /**
   * 切换侧边栏折叠状态
   */
  const toggleCollapsed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      collapsed: !prev.collapsed,
    }));
  }, []);
  
  /**
   * 设置侧边栏折叠状态
   * 
   * @param collapsed - 是否折叠
   */
  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({
      ...prev,
      collapsed,
    }));
  }, []);
  
  return {
    ...state,
    toggleTheme,
    setTheme,
    toggleCollapsed,
    setCollapsed,
  };
}

