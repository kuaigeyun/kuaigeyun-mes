/**
 * 触屏模式 Hook
 *
 * 提供触屏模式状态管理和切换功能
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isTouchDevice,
  isTouchScreenSize,
  shouldEnableTouchScreenMode,
  getTouchScreenMode,
  setTouchScreenMode,
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  onFullscreenChange,
  type TouchScreenMode,
} from '../utils/touchscreen';

/**
 * 触屏模式 Hook 返回值
 */
export interface UseTouchScreenReturn {
  /** 是否为触屏设备 */
  isTouchDevice: boolean;
  /** 是否为触屏屏幕尺寸 */
  isTouchScreenSize: boolean;
  /** 是否启用触屏模式 */
  isTouchScreenMode: boolean;
  /** 当前触屏模式设置 */
  mode: TouchScreenMode;
  /** 是否处于全屏模式 */
  isFullscreen: boolean;
  /** 切换触屏模式 */
  toggleMode: (mode?: TouchScreenMode) => void;
  /** 进入全屏 */
  enterFullscreen: () => Promise<void>;
  /** 退出全屏 */
  exitFullscreen: () => Promise<void>;
}

/**
 * 触屏模式 Hook
 */
export function useTouchScreen(): UseTouchScreenReturn {
  const [isTouchDeviceState, setIsTouchDeviceState] = useState(false);
  const [isTouchScreenSizeState, setIsTouchScreenSizeState] = useState(false);
  const [isTouchScreenModeState, setIsTouchScreenModeState] = useState(false);
  const [mode, setModeState] = useState<TouchScreenMode>('auto');
  const [isFullscreenState, setIsFullscreenState] = useState(false);

  /**
   * 更新触屏设备状态
   */
  const updateTouchDeviceState = useCallback(() => {
    setIsTouchDeviceState(isTouchDevice());
    setIsTouchScreenSizeState(isTouchScreenSize());
  }, []);

  /**
   * 更新触屏模式状态
   */
  const updateTouchScreenModeState = useCallback(() => {
    const currentMode = getTouchScreenMode();
    setModeState(currentMode);
    setIsTouchScreenModeState(shouldEnableTouchScreenMode());
  }, []);

  /**
   * 初始化
   */
  useEffect(() => {
    updateTouchDeviceState();
    updateTouchScreenModeState();

    // 监听窗口大小变化
    const handleResize = () => {
      updateTouchDeviceState();
      updateTouchScreenModeState();
    };

    window.addEventListener('resize', handleResize);

    // 监听全屏状态变化
    const unsubscribe = onFullscreenChange((isFullscreen) => {
      setIsFullscreenState(isFullscreen);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
    };
  }, [updateTouchDeviceState, updateTouchScreenModeState]);

  /**
   * 切换触屏模式
   */
  const toggleMode = useCallback((newMode?: TouchScreenMode) => {
    if (newMode) {
      setTouchScreenMode(newMode);
      setModeState(newMode);
      setIsTouchScreenModeState(shouldEnableTouchScreenMode());
    } else {
      // 如果没有指定模式，则在 enabled/disabled/auto 之间循环
      const currentMode = getTouchScreenMode();
      let nextMode: TouchScreenMode;
      if (currentMode === 'auto') {
        nextMode = 'enabled';
      } else if (currentMode === 'enabled') {
        nextMode = 'disabled';
      } else {
        nextMode = 'auto';
      }
      setTouchScreenMode(nextMode);
      setModeState(nextMode);
      setIsTouchScreenModeState(shouldEnableTouchScreenMode());
    }
  }, []);

  /**
   * 进入全屏
   */
  const handleEnterFullscreen = useCallback(async () => {
    try {
      await enterFullscreen();
      setIsFullscreenState(true);
    } catch (error) {
      console.error('进入全屏失败:', error);
    }
  }, []);

  /**
   * 退出全屏
   */
  const handleExitFullscreen = useCallback(async () => {
    try {
      await exitFullscreen();
      setIsFullscreenState(false);
    } catch (error) {
      console.error('退出全屏失败:', error);
    }
  }, []);

  return {
    isTouchDevice: isTouchDeviceState,
    isTouchScreenSize: isTouchScreenSizeState,
    isTouchScreenMode: isTouchScreenModeState,
    mode,
    isFullscreen: isFullscreenState,
    toggleMode,
    enterFullscreen: handleEnterFullscreen,
    exitFullscreen: handleExitFullscreen,
  };
}
