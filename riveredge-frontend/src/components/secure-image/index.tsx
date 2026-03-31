/**
 * SecureImage 组件
 *
 * 用于显示需要鉴权的文件图片。通过 getFilePreview 获取带 token 的 URL，
 * 解决生产环境中 img 标签无法携带 Authorization 头导致的图片无法显示问题。
 */

import React, { useEffect, useState, useRef } from 'react';
import { Image, Skeleton } from 'antd';
import { getFileDownloadUrlWithToken } from '../../services/file';

export interface SecureImageProps {
  /** 文件 UUID 或 直接图片 URL */
  fileUuid?: string;
  /** 直接图片 URL (可选，如果提供则跳过鉴权请求) */
  src?: string;
  /** 图片 alt 文本 */
  alt?: string;
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 样式 */
  style?: React.CSSProperties;
  /** 是否用于头像（请求缩略图） */
  forAvatar?: boolean;
  /** 预览配置 */
  preview?: boolean | { src?: string };
  /** 加载失败回调 */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** 加载完成回调 */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * 带鉴权的图片组件 - 优化加载性能
 */
export const SecureImage: React.FC<SecureImageProps> = ({
  fileUuid,
  src: initialSrc,
  alt = '',
  width,
  height,
  style,
  forAvatar = false,
  preview = true,
  onError,
  onLoad,
}) => {
  const [src, setSrc] = useState<string | null>(initialSrc || null);
  const [loading, setLoading] = useState(!initialSrc);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const restoreBodyInteraction = React.useCallback(() => {
    // Ant Image 预览关闭后可能遗留 pointer-events: none 样式导致页面无法点击
    if (typeof document === 'undefined') return;
    
    // 强制恢复样式，不论 DOM 是否还存在预览容器
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = 'auto';
    // 移除 Ant 可能添加的全局类名
    document.body.classList.remove('ant-scrolling-effect');
    // 兜底清空 inline style
    document.body.style.removeProperty('pointer-events');
    document.body.style.removeProperty('overflow');
  }, []);

  // 1. 延迟加载：仅当组件进入可视区域时才触发 API 请求鉴权 URL
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' }); // 提前 200px 加载

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [fileUuid, initialSrc]);

  // 2. 获取鉴权后的预览 URL
  useEffect(() => {
    if (!isVisible) return;
    
    // 如果已经有初始 src，就不需要请求
    if (initialSrc) {
      setSrc(initialSrc);
      setLoading(false);
      return;
    }

    if (!fileUuid) return;

    let cancelled = false;
    setLoading(true);
    getFileDownloadUrlWithToken(fileUuid, { forAvatar })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileUuid, forAvatar, isVisible, initialSrc]);

  useEffect(() => {
    return () => {
      restoreBodyInteraction();
    };
  }, [restoreBodyInteraction]);

  const previewConfig = React.useMemo(() => {
    if (!preview) return false;
    const base = typeof preview === 'object' ? { ...preview } : {};
    return {
      ...base,
      src: src || undefined,
      onVisibleChange: (visible: boolean) => {
        if (!visible) {
          // 动画结束后强制恢复交互，分多个延时周期循环清理，直到确认 body 样式恢复
          // 这是由于 Ant Design 5 内部清理有时会被 React 并发渲染打断或产生竞争
          let count = 0;
          const interval = setInterval(() => {
            restoreBodyInteraction();
            count++;
            if (count > 5) clearInterval(interval);
          }, 200);
        }
      },
    };
  }, [preview, src, restoreBodyInteraction]);

  // 全局逃生口：在 window 层侦测 mousedown，如果有任何卡死迹象，强制恢复
  useEffect(() => {
    const handleGlobalRecovery = () => {
      if (typeof document !== 'undefined' && 
          document.body.style.pointerEvents === 'none') {
        restoreBodyInteraction();
      }
    };
    window.addEventListener('mousedown', handleGlobalRecovery, { capture: true });
    window.addEventListener('touchstart', handleGlobalRecovery, { capture: true, passive: true });
    return () => {
      window.removeEventListener('mousedown', handleGlobalRecovery, { capture: true });
      window.removeEventListener('touchstart', handleGlobalRecovery, { capture: true });
    };
  }, [restoreBodyInteraction]);

  const placeholder = (
    <div
      ref={containerRef}
      style={{
        width: width ?? 40,
        height: height ?? 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 4,
        ...style,
      }}
    >
      <Skeleton.Avatar active shape="square" size={typeof width === 'number' ? width : 40} />
    </div>
  );

  if (!isVisible || loading) {
    return placeholder;
  }

  if (error || !src) {
    return (
      <div
        style={{
          width: width ?? 40,
          height: height ?? 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          color: '#bfbfbf',
          fontSize: 12,
          borderRadius: 4,
          ...style,
        }}
      >
        {alt || 'Error'}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'inline-block', lineHeight: 0 }}>
      <Image
        src={src || undefined}
        alt={alt}
        width={width}
        height={height}
        style={{ objectFit: 'cover', borderRadius: 4, ...style }}
        preview={previewConfig}
        placeholder={<Skeleton.Avatar active shape="square" size={typeof width === 'number' ? width : 40} />}
        onError={(e) => {
          setError(true);
          onError?.(e);
        }}
        onLoad={onLoad}
      />
    </div>
  );
};

export default SecureImage;
