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
  isPortrait,
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
  /** 是否处于竖屏模式 */
  isPortrait: boolean;
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
  const [isPortraitState, setIsPortraitState] = useState(false);

  /**
   * 更新触屏设备状态
   */
  const updateTouchDeviceState = useCallback(() => {
    setIsTouchDeviceState(isTouchDevice());
    setIsTouchScreenSizeState(isTouchScreenSize());
    setIsPortraitState(isPortrait());
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

    // resize 在拖拽窗口时会高频触发；合并到短节流，避免 BasicLayout 等整树频繁 setState 丢帧
    let resizeTick: ReturnType<typeof setTimeout> | undefined;
    const scheduleResizeSync = () => {
      if (resizeTick) return;
      resizeTick = setTimeout(() => {
        resizeTick = undefined;
        updateTouchDeviceState();
        updateTouchScreenModeState();
      }, 120);
    };

    window.addEventListener('resize', scheduleResizeSync, { passive: true });
    const onOrientation = () => {
      updateTouchDeviceState();
      updateTouchScreenModeState();
    };
    window.addEventListener('orientationchange', onOrientation);

    // 监听全屏状态变化
    const unsubscribe = onFullscreenChange((isFullscreen) => {
      setIsFullscreenState(isFullscreen);
    });

    return () => {
      if (resizeTick) clearTimeout(resizeTick);
      window.removeEventListener('resize', scheduleResizeSync);
      window.removeEventListener('orientationchange', onOrientation);
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
    isPortrait: isPortraitState,
    toggleMode,
    enterFullscreen: handleEnterFullscreen,
    exitFullscreen: handleExitFullscreen,
  };
}
