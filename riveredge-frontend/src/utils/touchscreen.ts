/**
 * 触屏模式工具函数
 *
 * 提供触屏设备检测、模式切换等功能
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

/**
 * 检测是否为触屏设备
 */
export function isTouchDevice(): boolean {
  // 检测触摸支持
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 检测移动设备
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  // 检测工位机设备（通过User-Agent或特定标识）
  const isKioskDevice = /Kiosk|Workstation|TouchScreen/i.test(navigator.userAgent) ||
    window.location.search.includes('kiosk=true') ||
    window.location.search.includes('touchscreen=true');
  
  return hasTouchSupport || isMobileDevice || isKioskDevice;
}

/**
 * 检测屏幕尺寸是否适合触屏模式
 */
export function isTouchScreenSize(): boolean {
  // 触屏模式通常需要较大的屏幕（≥768px宽度）
  // 但也要考虑平板等设备
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // 平板或更大的设备
  return width >= 768 && height >= 600;
}

/**
 * 触屏模式存储键名
 */
const TOUCH_SCREEN_MODE_KEY = 'touchscreen_mode';

/**
 * 触屏模式类型
 */
export type TouchScreenMode = 'auto' | 'enabled' | 'disabled';

/**
 * 获取触屏模式设置
 */
export function getTouchScreenMode(): TouchScreenMode {
  try {
    const stored = localStorage.getItem(TOUCH_SCREEN_MODE_KEY);
    if (stored === 'enabled' || stored === 'disabled' || stored === 'auto') {
      return stored as TouchScreenMode;
    }
  } catch (error) {
    console.error('获取触屏模式设置失败:', error);
  }
  return 'auto'; // 默认自动检测
}

/**
 * 设置触屏模式
 */
export function setTouchScreenMode(mode: TouchScreenMode): void {
  try {
    localStorage.setItem(TOUCH_SCREEN_MODE_KEY, mode);
  } catch (error) {
    console.error('设置触屏模式失败:', error);
  }
}

/**
 * 判断是否应该启用触屏模式
 */
export function shouldEnableTouchScreenMode(): boolean {
  const mode = getTouchScreenMode();
  
  if (mode === 'enabled') {
    return true;
  }
  
  if (mode === 'disabled') {
    return false;
  }
  
  // auto 模式：自动检测
  return isTouchDevice() && isTouchScreenSize();
}

/**
 * 进入全屏模式
 */
export function enterFullscreen(): Promise<void> {
  return new Promise((resolve, reject) => {
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
      element.requestFullscreen().then(resolve).catch(reject);
    } else if ((element as any).webkitRequestFullscreen) {
      // ⚠️ 兼容性修复：旧版 Safari webkitRequestFullscreen 不返回 Promise
      const result = (element as any).webkitRequestFullscreen();
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        resolve(); // 假设成功
      }
    } else if ((element as any).mozRequestFullScreen) {
      (element as any).mozRequestFullScreen();
      resolve();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
      resolve();
    } else {
      reject(new Error('浏览器不支持全屏模式'));
    }
  });
}

/**
 * 退出全屏模式
 */
export function exitFullscreen(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(resolve).catch(reject);
    } else if ((document as any).webkitExitFullscreen) {
      // ⚠️ 兼容性修复：旧版 Safari webkitExitFullscreen 不返回 Promise
      const result = (document as any).webkitExitFullscreen();
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        resolve(); // 假设成功
      }
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
      resolve();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
      resolve();
    } else {
      reject(new Error('浏览器不支持全屏模式'));
    }
  });
}

/**
 * 检测是否处于全屏模式
 */
export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

/**
 * 监听全屏状态变化
 */
export function onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void {
  const handleChange = () => {
    callback(isFullscreen());
  };
  
  document.addEventListener('fullscreenchange', handleChange);
  document.addEventListener('webkitfullscreenchange', handleChange);
  document.addEventListener('mozfullscreenchange', handleChange);
  document.addEventListener('MSFullscreenChange', handleChange);
  
  return () => {
    document.removeEventListener('fullscreenchange', handleChange);
    document.removeEventListener('webkitfullscreenchange', handleChange);
    document.removeEventListener('mozfullscreenchange', handleChange);
    document.removeEventListener('MSFullscreenChange', handleChange);
  };
}
