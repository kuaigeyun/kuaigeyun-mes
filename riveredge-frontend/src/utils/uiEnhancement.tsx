/**
 * 界面设计优化工具模块
 *
 * 提供界面设计优化相关的工具函数，包括主题定制、动画效果、响应式设计等。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

/**
 * 主题配置接口
 */
export interface ThemeConfigOptions {
  /** 主色调 */
  colorPrimary?: string;
  /** 圆角大小 */
  borderRadius?: number;
  /** 字体大小 */
  fontSize?: number;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 是否深色模式 */
  dark?: boolean;
  /** 侧边栏背景色 */
  siderBgColor?: string;
  /** 头部背景色 */
  headerBgColor?: string;
  /** 标签页背景色 */
  tabsBgColor?: string;
}

/**
 * 主题管理器
 */
export class ThemeManager {
  /**
   * 生成主题配置
   */
  static generateThemeConfig(options: ThemeConfigOptions): ThemeConfig {
    const {
      colorPrimary = '#1890ff',
      borderRadius = 6,
      fontSize = 14,
      compact = false,
      dark = false,
    } = options;

    const baseAlgorithm = dark ? theme.darkAlgorithm : theme.defaultAlgorithm;
    const algorithm = compact
      ? [baseAlgorithm, theme.compactAlgorithm]
      : baseAlgorithm;

    return {
      algorithm,
      token: {
        colorPrimary,
        borderRadius,
        fontSize,
      },
    };
  }

  /**
   * 预设主题配置
   */
  static getPresetThemes(): Record<string, ThemeConfigOptions> {
    return {
      default: {
        colorPrimary: '#1890ff',
        borderRadius: 6,
        fontSize: 14,
        compact: false,
        dark: false,
      },
      dark: {
        colorPrimary: '#1890ff',
        borderRadius: 6,
        fontSize: 14,
        compact: false,
        dark: true,
      },
      compact: {
        colorPrimary: '#1890ff',
        borderRadius: 4,
        fontSize: 13,
        compact: true,
        dark: false,
      },
      modern: {
        colorPrimary: '#722ed1',
        borderRadius: 8,
        fontSize: 14,
        compact: false,
        dark: false,
      },
      professional: {
        colorPrimary: '#13c2c2',
        borderRadius: 4,
        fontSize: 14,
        compact: false,
        dark: false,
      },
    };
  }

  /**
   * 应用主题配置
   */
  static applyTheme(config: ThemeConfig): void {
    // 这里可以添加主题应用逻辑
    // 例如：更新CSS变量、应用样式等
    console.log('应用主题配置:', config);
  }
}

/**
 * 动画工具类
 */
export class AnimationHelper {
  /**
   * 获取淡入动画样式
   */
  static getFadeInStyle(duration: number = 300): React.CSSProperties {
    return {
      animation: `fadeIn ${duration}ms ease-in-out`,
    };
  }

  /**
   * 获取淡出动画样式
   */
  static getFadeOutStyle(duration: number = 300): React.CSSProperties {
    return {
      animation: `fadeOut ${duration}ms ease-in-out`,
    };
  }

  /**
   * 获取滑入动画样式
   */
  static getSlideInStyle(
    direction: 'left' | 'right' | 'top' | 'bottom' = 'right',
    duration: number = 300
  ): React.CSSProperties {
    const translateMap = {
      left: 'translateX(-100%)',
      right: 'translateX(100%)',
      top: 'translateY(-100%)',
      bottom: 'translateY(100%)',
    };

    return {
      animation: `slideIn${direction.charAt(0).toUpperCase() + direction.slice(1)} ${duration}ms ease-in-out`,
      transform: translateMap[direction],
    };
  }

  /**
   * 获取缩放动画样式
   */
  static getScaleStyle(duration: number = 300): React.CSSProperties {
    return {
      animation: `scale ${duration}ms ease-in-out`,
    };
  }

  /**
   * 获取加载动画样式
   */
  static getLoadingStyle(): React.CSSProperties {
    return {
      animation: 'spin 1s linear infinite',
    };
  }
}

/**
 * 响应式设计工具
 */
export class ResponsiveHelper {
  /**
   * 响应式断点配置
   */
  static breakpoints = {
    xs: 480,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1600,
  };

  /**
   * 检测当前屏幕尺寸
   */
  static getCurrentBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' {
    const width = window.innerWidth;

    if (width >= this.breakpoints.xxl) return 'xxl';
    if (width >= this.breakpoints.xl) return 'xl';
    if (width >= this.breakpoints.lg) return 'lg';
    if (width >= this.breakpoints.md) return 'md';
    if (width >= this.breakpoints.sm) return 'sm';
    return 'xs';
  }

  /**
   * 是否为移动设备
   */
  static isMobile(): boolean {
    return this.getCurrentBreakpoint() === 'xs' || this.getCurrentBreakpoint() === 'sm';
  }

  /**
   * 是否为平板设备
   */
  static isTablet(): boolean {
    return this.getCurrentBreakpoint() === 'md';
  }

  /**
   * 是否为桌面设备
   */
  static isDesktop(): boolean {
    return (
      this.getCurrentBreakpoint() === 'lg' ||
      this.getCurrentBreakpoint() === 'xl' ||
      this.getCurrentBreakpoint() === 'xxl'
    );
  }

  /**
   * 获取响应式列数
   */
  static getResponsiveColumns(
    desktop: number,
    tablet?: number,
    mobile?: number
  ): { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; xxl?: number } {
    return {
      xs: mobile || 24,
      sm: mobile || 24,
      md: tablet || 12,
      lg: desktop,
      xl: desktop,
      xxl: desktop,
    };
  }
}

/**
 * 视觉层次工具
 */
export class VisualHierarchyHelper {
  /**
   * 获取阴影样式（根据层级）
   */
  static getShadowStyle(level: 0 | 1 | 2 | 3 | 4 = 1): React.CSSProperties {
    const shadows = {
      0: 'none',
      1: '0 2px 8px rgba(0, 0, 0, 0.15)',
      2: '0 4px 12px rgba(0, 0, 0, 0.15)',
      3: '0 8px 16px rgba(0, 0, 0, 0.15)',
      4: '0 12px 24px rgba(0, 0, 0, 0.15)',
    };

    return {
      boxShadow: shadows[level],
    };
  }

  /**
   * 获取边框样式（根据层级）
   */
  static getBorderStyle(level: 0 | 1 | 2 = 1): React.CSSProperties {
    const borders = {
      0: 'none',
      1: '1px solid #f0f0f0',
      2: '2px solid #d9d9d9',
    };

    return {
      border: borders[level],
    };
  }

  /**
   * 获取圆角样式（根据尺寸）
   */
  static getBorderRadiusStyle(size: 'small' | 'medium' | 'large' = 'medium'): React.CSSProperties {
    const radius = {
      small: 4,
      medium: 6,
      large: 8,
    };

    return {
      borderRadius: radius[size],
    };
  }
}

/**
 * 交互反馈工具
 */
export class InteractionFeedbackHelper {
  /**
   * 获取悬停样式
   */
  static getHoverStyle(): React.CSSProperties {
    return {
      transition: 'all 0.3s ease',
      cursor: 'pointer',
    };
  }

  /**
   * 获取激活样式
   */
  static getActiveStyle(): React.CSSProperties {
    return {
      transform: 'scale(0.98)',
      transition: 'transform 0.1s ease',
    };
  }

  /**
   * 获取聚焦样式
   */
  static getFocusStyle(): React.CSSProperties {
    return {
      outline: '2px solid #1890ff',
      outlineOffset: '2px',
      transition: 'outline 0.2s ease',
    };
  }

  /**
   * 获取禁用样式
   */
  static getDisabledStyle(): React.CSSProperties {
    return {
      opacity: 0.6,
      cursor: 'not-allowed',
      pointerEvents: 'none',
    };
  }
}

/**
 * 布局优化工具
 */
export class LayoutOptimizer {
  /**
   * 获取标准间距
   */
  static getSpacing(size: 'small' | 'medium' | 'large' = 'medium'): number {
    const spacing = {
      small: 8,
      medium: 16,
      large: 24,
    };

    return spacing[size];
  }

  /**
   * 获取标准内边距
   */
  static getPadding(size: 'small' | 'medium' | 'large' = 'medium'): React.CSSProperties {
    const padding = {
      small: '8px',
      medium: '16px',
      large: '24px',
    };

    return {
      padding: padding[size],
    };
  }

  /**
   * 获取标准外边距
   */
  static getMargin(size: 'small' | 'medium' | 'large' = 'medium'): React.CSSProperties {
    const margin = {
      small: '8px',
      medium: '16px',
      large: '24px',
    };

    return {
      margin: margin[size],
    };
  }
}
