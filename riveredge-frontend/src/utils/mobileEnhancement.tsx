/**
 * 移动端和触屏模式体验优化工具模块
 *
 * 提供移动端和触屏模式的体验优化功能，包括手势支持、输入优化、布局优化等。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import { isTouchDevice, isTouchScreenSize, shouldEnableTouchScreenMode } from './touchscreen';

/**
 * 设备类型
 */
export enum DeviceType {
  /** 移动设备 */
  MOBILE = 'mobile',
  /** 平板设备 */
  TABLET = 'tablet',
  /** 桌面设备 */
  DESKTOP = 'desktop',
  /** 工位机设备 */
  KIOSK = 'kiosk',
}

/**
 * 设备检测器
 */
export class DeviceDetector {
  /**
   * 检测设备类型
   */
  static detectDeviceType(): DeviceType {
    const width = window.innerWidth;
    const userAgent = navigator.userAgent;

    // 检测工位机设备
    const isKioskDevice = /Kiosk|Workstation|TouchScreen/i.test(userAgent) ||
      window.location.search.includes('kiosk=true') ||
      window.location.search.includes('touchscreen=true');

    if (isKioskDevice) {
      return DeviceType.KIOSK;
    }

    // 检测移动设备
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (isMobileDevice) {
      // 区分手机和平板
      if (width >= 768) {
        return DeviceType.TABLET;
      }
      return DeviceType.MOBILE;
    }

    // 桌面设备
    return DeviceType.DESKTOP;
  }

  /**
   * 是否为移动设备
   */
  static isMobile(): boolean {
    const type = this.detectDeviceType();
    return type === DeviceType.MOBILE || type === DeviceType.TABLET;
  }

  /**
   * 是否为触屏设备
   */
  static isTouchDevice(): boolean {
    return isTouchDevice();
  }

  /**
   * 是否为工位机设备
   */
  static isKioskDevice(): boolean {
    return this.detectDeviceType() === DeviceType.KIOSK;
  }

  /**
   * 是否应该启用触屏模式
   */
  static shouldEnableTouchScreenMode(): boolean {
    return shouldEnableTouchScreenMode();
  }
}

/**
 * 手势支持工具
 */
export class GestureHelper {
  /**
   * 检测手势类型
   */
  static detectGesture(event: TouchEvent): 'tap' | 'doubleTap' | 'longPress' | 'swipe' | 'pinch' | 'rotate' | 'none' {
    const touches = event.touches;
    const changedTouches = event.changedTouches;

    // 单点触摸
    if (touches.length === 1) {
      // 长按检测（需要结合时间）
      // 这里只检测基本手势，具体实现需要结合时间戳
      return 'tap';
    }

    // 双点触摸
    if (touches.length === 2) {
      // 捏合手势
      return 'pinch';
    }

    return 'none';
  }

  /**
   * 计算两点之间的距离
   */
  static getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算两点之间的角度
   */
  static getAngle(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }
}

/**
 * 输入优化工具
 */
export class InputOptimizer {
  /**
   * 获取触屏优化的输入框样式
   */
  static getTouchInputStyle(): React.CSSProperties {
    return {
      minHeight: '60px',
      fontSize: '24px',
      padding: '12px 16px',
    };
  }

  /**
   * 获取移动端优化的输入框样式
   */
  static getMobileInputStyle(): React.CSSProperties {
    return {
      minHeight: '44px',
      fontSize: '16px',
      padding: '8px 12px',
    };
  }

  /**
   * 获取触屏优化的按钮样式
   */
  static getTouchButtonStyle(): React.CSSProperties {
    return {
      minHeight: '60px',
      fontSize: '24px',
      padding: '12px 24px',
    };
  }

  /**
   * 获取移动端优化的按钮样式
   */
  static getMobileButtonStyle(): React.CSSProperties {
    return {
      minHeight: '44px',
      fontSize: '16px',
      padding: '8px 16px',
    };
  }

  /**
   * 是否应该显示虚拟键盘
   */
  static shouldShowVirtualKeyboard(inputType: string): boolean {
    // 触屏模式下，某些输入类型应该显示虚拟键盘
    const touchKeyboardTypes = ['text', 'number', 'tel', 'email', 'url', 'search'];
    return touchKeyboardTypes.includes(inputType);
  }
}

/**
 * 布局优化工具
 */
export class LayoutOptimizer {
  /**
   * 获取触屏优化的间距
   */
  static getTouchSpacing(size: 'small' | 'medium' | 'large' = 'medium'): number {
    const spacing = {
      small: 20,
      medium: 24,
      large: 32,
    };
    return spacing[size];
  }

  /**
   * 获取移动端优化的间距
   */
  static getMobileSpacing(size: 'small' | 'medium' | 'large' = 'medium'): number {
    const spacing = {
      small: 12,
      medium: 16,
      large: 24,
    };
    return spacing[size];
  }

  /**
   * 获取触屏优化的字体大小
   */
  static getTouchFontSize(type: 'body' | 'title' | 'heading' = 'body'): number {
    const sizes = {
      body: 24,
      title: 32,
      heading: 28,
    };
    return sizes[type];
  }

  /**
   * 获取移动端优化的字体大小
   */
  static getMobileFontSize(type: 'body' | 'title' | 'heading' = 'body'): number {
    const sizes = {
      body: 16,
      title: 20,
      heading: 18,
    };
    return sizes[type];
  }
}

/**
 * 性能优化工具
 */
export class PerformanceOptimizer {
  /**
   * 是否应该启用硬件加速
   */
  static shouldEnableHardwareAcceleration(): boolean {
    // 移动设备和触屏设备应该启用硬件加速
    return DeviceDetector.isMobile() || DeviceDetector.isTouchDevice();
  }

  /**
   * 获取硬件加速样式
   */
  static getHardwareAccelerationStyle(): React.CSSProperties {
    return {
      transform: 'translateZ(0)',
      willChange: 'transform',
    };
  }

  /**
   * 是否应该启用防抖
   */
  static shouldEnableDebounce(): boolean {
    // 移动设备应该启用防抖
    return DeviceDetector.isMobile();
  }

  /**
   * 防抖函数
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 300
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (this: any, ...args: Parameters<T>) {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  }
}
