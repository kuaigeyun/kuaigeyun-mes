/**
 * SecureImage 组件
 *
 * 分级加载：列表小缩略图 → 预览中等图 → 用户点击「查看原图」后全分辨率。
 * 通过 getFilePreview 获取带 token 的 URL，解决 img 无法携带 Authorization 的问题。
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Image, Skeleton, Button, App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  getFileDownloadUrlWithToken,
  FILE_IMAGE_SIZE_THUMB,
  FILE_IMAGE_SIZE_MEDIUM,
  FILE_IMAGE_SIZE_AVATAR,
} from '../../services/file';

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
  /** 是否用于头像（列表缩略图边长 128） */
  forAvatar?: boolean;
  /** 列表展示缩略图边长，默认 64；forAvatar 时默认 128 */
  thumbSize?: number;
  /** 预览弹层默认图边长，默认 512 */
  previewSize?: number;
  /** 预览工具栏是否显示「查看原图」 */
  enableOriginalAction?: boolean;
  /** 预览配置 */
  preview?: boolean | { src?: string };
  /** 加载失败回调 */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** 加载完成回调 */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** 在父容器内水平垂直居中，图片 max 100% 且保持比例（配合 object-fit: contain） */
  fitCenter?: boolean;
  /** 列表场景：进入视口后再请求缩略图（避免表格一次加载几十张） */
  lazyLoad?: boolean;
}

function resolveThumbSize(
  forAvatar: boolean,
  thumbSize: number | undefined,
  width: number | string | undefined,
): number {
  if (thumbSize != null) return thumbSize;
  if (forAvatar) return FILE_IMAGE_SIZE_AVATAR;
  if (typeof width === 'number' && width > 0) {
    return Math.min(FILE_IMAGE_SIZE_THUMB, Math.max(32, Math.ceil(width * 2)));
  }
  return FILE_IMAGE_SIZE_THUMB;
}

/**
 * 带鉴权的图片组件 - 小图 / 中图 / 原图分级加载
 */
export const SecureImage: React.FC<SecureImageProps> = ({
  fileUuid,
  src: initialSrc,
  alt = '',
  width,
  height,
  style,
  forAvatar = false,
  thumbSize: thumbSizeProp,
  previewSize = FILE_IMAGE_SIZE_MEDIUM,
  enableOriginalAction = true,
  preview = true,
  onError,
  onLoad,
  fitCenter = false,
  lazyLoad = false,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const thumbSize = resolveThumbSize(forAvatar, thumbSizeProp, width);
  const useTieredLoading = Boolean(fileUuid) && !initialSrc;

  const [src, setSrc] = useState<string | null>(initialSrc || null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isOriginalPreview, setIsOriginalPreview] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const previewEnabled = !!preview;
  const [loading, setLoading] = useState(!initialSrc);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(previewEnabled);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const openPreview = useCallback(() => {
    if (!previewEnabled) return;
    setPreviewVisible(true);
  }, [previewEnabled]);

  const handlePreviewOpenChange = useCallback((visible: boolean) => {
    setPreviewVisible(visible);
    if (!visible) {
      setPreviewEpoch((v) => v + 1);
      setPreviewSrc(null);
      setIsOriginalPreview(false);
    }
  }, []);

  const handleViewOriginal = useCallback(async () => {
    if (!fileUuid || loadingOriginal || isOriginalPreview) return;
    setLoadingOriginal(true);
    try {
      const url = await getFileDownloadUrlWithToken(fileUuid);
      setPreviewSrc(url);
      setIsOriginalPreview(true);
      messageApi.success(t('components.secureImage.switchedToOriginal'));
    } catch {
      messageApi.error(t('common.loadFailed'));
    } finally {
      setLoadingOriginal(false);
    }
  }, [fileUuid, loadingOriginal, isOriginalPreview, messageApi, t]);

  useEffect(() => {
    if (previewEnabled && !lazyLoad) {
      setIsVisible(true);
      return;
    }
    setIsVisible(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [fileUuid, initialSrc, previewEnabled, lazyLoad]);

  useEffect(() => {
    if (!isVisible) return;

    if (initialSrc) {
      setSrc(initialSrc);
      setLoading(false);
      return;
    }

    if (!fileUuid) return;

    let cancelled = false;
    setLoading(true);
    const fetchOptions = useTieredLoading
      ? { size: thumbSize }
      : forAvatar
        ? { forAvatar: true }
        : undefined;

    getFileDownloadUrlWithToken(fileUuid, fetchOptions)
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
  }, [fileUuid, forAvatar, isVisible, initialSrc, thumbSize, useTieredLoading]);

  useEffect(() => {
    if (!previewVisible || !useTieredLoading || !fileUuid) return;

    let cancelled = false;
    getFileDownloadUrlWithToken(fileUuid, { size: previewSize })
      .then((url) => {
        if (!cancelled) {
          setPreviewSrc(url);
          setIsOriginalPreview(false);
        }
      })
      .catch(() => {
        if (!cancelled && src) {
          setPreviewSrc(src);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewVisible, fileUuid, previewSize, useTieredLoading, src]);

  const previewConfig = React.useMemo(() => {
    if (!preview) return false;

    const resolvedPreviewSrc = useTieredLoading
      ? previewSrc || src || undefined
      : preview === true
        ? src || undefined
        : preview.src || src || undefined;

    const tieredActions =
      useTieredLoading && enableOriginalAction && fileUuid
        ? (originalNode: React.ReactElement) => (
            <>
              {originalNode}
              {!isOriginalPreview && (
                <Button
                  type="link"
                  size="small"
                  loading={loadingOriginal}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleViewOriginal();
                  }}
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  {loadingOriginal
                    ? t('components.secureImage.loadingOriginal')
                    : t('components.secureImage.viewOriginal')}
                </Button>
              )}
            </>
          )
        : undefined;

    if (preview === true) {
      return {
        src: resolvedPreviewSrc,
        destroyOnHidden: true,
        open: previewVisible,
        onOpenChange: handlePreviewOpenChange,
        actionsRender: tieredActions,
      };
    }
    return {
      ...preview,
      src: preview.src || resolvedPreviewSrc,
      destroyOnHidden: true,
      open: previewVisible,
      onOpenChange: handlePreviewOpenChange,
      actionsRender: tieredActions,
    };
  }, [
    preview,
    src,
    previewSrc,
    previewVisible,
    useTieredLoading,
    enableOriginalAction,
    fileUuid,
    isOriginalPreview,
    loadingOriginal,
    handleViewOriginal,
    handlePreviewOpenChange,
    t,
  ]);

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
