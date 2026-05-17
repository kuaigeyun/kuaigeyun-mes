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
  /** 在父容器内水平垂直居中，图片 max 100% 且保持比例（配合 object-fit: contain） */
  fitCenter?: boolean;
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
  fitCenter = false,
}) => {
  const [src, setSrc] = useState<string | null>(initialSrc || null);
  const previewEnabled = !!preview;
  const [loading, setLoading] = useState(!initialSrc);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(previewEnabled);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const openPreview = React.useCallback(() => {
    if (!previewEnabled) return;
    setPreviewVisible(true);
  }, [previewEnabled]);

  // 1. 延迟加载：仅当组件进入可视区域时才触发 API 请求鉴权 URL
  useEffect(() => {
    if (previewEnabled) {
      setIsVisible(true);
      return;
    }
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
  }, [fileUuid, initialSrc, previewEnabled]);

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

  const previewConfig = React.useMemo(() => {
    if (!preview) return false;
    if (preview === true) {
      return {
        src: src || undefined,
        destroyOnHidden: true,
        visible: previewVisible,
        onVisibleChange: (visible: boolean) => {
          setPreviewVisible(visible);
          if (!visible) {
            setPreviewEpoch((v) => v + 1);
          }
        },
      };
    }
    return {
      ...preview,
      src: preview.src || src || undefined,
      destroyOnHidden: true,
      visible: previewVisible,
      onVisibleChange: (visible: boolean) => {
        setPreviewVisible(visible);
        if (!visible) {
          setPreviewEpoch((v) => v + 1);
        }
      },
    };
  }, [preview, src, previewVisible]);

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

  const wrapperStyle: React.CSSProperties = fitCenter
    ? {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        lineHeight: 0,
      }
    : { display: 'inline-block', lineHeight: 0 };

  const imageStyle: React.CSSProperties = fitCenter
    ? {
        objectFit: 'contain',
        objectPosition: 'center',
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto',
        borderRadius: 4,
        ...style,
      }
    : { objectFit: 'cover', borderRadius: 4, ...style };

  return (
    <div ref={containerRef} style={wrapperStyle}>
      <Image
        key={`secure-image-${previewEpoch}`}
        src={src || undefined}
        alt={alt}
        width={fitCenter ? undefined : width}
        height={fitCenter ? undefined : height}
        style={imageStyle}
        preview={previewConfig}
        onClick={openPreview}
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
