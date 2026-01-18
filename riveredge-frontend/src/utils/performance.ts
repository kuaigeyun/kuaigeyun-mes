/**
 * 前端性能监控工具
 *
 * 提供性能监控、资源预加载等功能。
 *
 * Author: Auto (AI Assistant)
 * Date: 2026-01-27
 */

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  /** 首屏加载时间（毫秒） */
  firstContentfulPaint?: number;
  /** 最大内容绘制时间（毫秒） */
  largestContentfulPaint?: number;
  /** 首次输入延迟（毫秒） */
  firstInputDelay?: number;
  /** 累积布局偏移 */
  cumulativeLayoutShift?: number;
  /** 路由切换时间（毫秒） */
  routeChangeTime?: number;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics = {};

  private constructor() {
    this.init();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 初始化性能监控
   */
  private init(): void {
    if (typeof window === 'undefined' || !window.performance) {
      return;
    }

    // 监听性能指标
    this.observePerformanceMetrics();
  }

  /**
   * 观察性能指标
   */
  private observePerformanceMetrics(): void {
    // 观察 Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP observer not supported:', e);
      }

      // 观察 First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('FID observer not supported:', e);
      }

      // 观察 Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as any[];
          entries.forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.cumulativeLayoutShift = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('CLS observer not supported:', e);
      }
    }

    // 获取 First Contentful Paint (FCP)
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.metrics.firstContentfulPaint = entry.startTime;
      }
    });
  }

  /**
   * 记录路由切换时间
   */
  recordRouteChange(startTime: number): void {
    const endTime = performance.now();
    this.metrics.routeChangeTime = endTime - startTime;

    // 如果路由切换时间超过阈值，记录警告
    if (this.metrics.routeChangeTime > 300) {
      console.warn(
        `⚠️ 慢路由切换检测: ${this.metrics.routeChangeTime.toFixed(2)}ms`
      );
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置性能指标
   */
  reset(): void {
    this.metrics = {};
  }
}

/**
 * 资源预加载工具
 */
export class ResourcePreloader {
  /**
   * 预加载脚本
   */
  static preloadScript(src: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = src;
    document.head.appendChild(link);
  }

  /**
   * 预加载样式表
   */
  static preloadStylesheet(href: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  }

  /**
   * 预连接服务器
   */
  static preconnect(url: string): void {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    document.head.appendChild(link);
  }

  /**
   * 预获取资源
   */
  static prefetch(href: string, as?: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    if (as) {
      link.as = as;
    }
    document.head.appendChild(link);
  }
}

/**
 * 图片懒加载工具
 */
export class ImageLazyLoader {
  /**
   * 初始化图片懒加载
   */
  static init(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.getAttribute('data-src');
          if (dataSrc) {
            img.src = dataSrc;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    });

    // 观察所有带有 data-src 属性的图片
    document.querySelectorAll('img[data-src]').forEach((img) => {
      imageObserver.observe(img);
    });
  }
}

/**
 * 导出单例实例
 */
export const performanceMonitor = PerformanceMonitor.getInstance();