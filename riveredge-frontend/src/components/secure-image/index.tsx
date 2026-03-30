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
  /** 文件 UUID */
  fileUuid: string;
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
  alt = '',
  width,
  height,
  style,
  forAvatar = false,
  preview = true,
  onError,
  onLoad,
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const restoreBodyInteraction = React.useCallback(() => {
    // Ant Image 预览关闭后偶发遗留样式，导致页面无法点击
    if (typeof document === 'undefined') return;
    const hasOpenPreview = !!document.querySelector('.ant-image-preview-wrap');
    if (!hasOpenPreview) {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }
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
  }, [fileUuid]);

  // 2. 获取鉴权后的预览 URL
  useEffect(() => {
    if (!isVisible || !fileUuid) return;

    let cancelled = false;
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
  }, [fileUuid, forAvatar, isVisible]);

  useEffect(() => {
    return () => {
      restoreBodyInteraction();
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

  const previewConfig = React.useMemo(() => {
    if (!preview) return false;
    const base = typeof preview === 'object' ? { ...preview } : {};
    return {
      ...base,
      src,
      getContainer: () => document.body,
      visible: previewOpen,
      onVisibleChange: (visible: boolean) => {
        setPreviewOpen(visible);
        if (!visible) {
          // 动画结束后再恢复，避免与 antd 关闭过渡竞争
          window.setTimeout(() => restoreBodyInteraction(), 50);
        }
      },
    };
  }, [preview, previewOpen, src, restoreBodyInteraction]);

  return (
    <div ref={containerRef} style={{ display: 'inline-block', lineHeight: 0 }}>
      <Image
        src={src}
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
