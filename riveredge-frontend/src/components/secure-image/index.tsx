/**
 * SecureImage 组件
 *
 * 用于显示需要鉴权的文件图片。通过 getFilePreview 获取带 token 的 URL，
 * 解决生产环境中 img 标签无法携带 Authorization 头导致的图片无法显示问题。
 */

import React, { useEffect, useState } from 'react';
import { Image } from 'antd';
import { getFileDownloadUrlWithToken } from '../../services/file';

export interface SecureImageProps {
  /** 文件 UUID */
  fileUuid: string;
  /** 图片 alt 文本 */
  alt?: string;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
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
 * 带鉴权的图片组件
 *
 * 生产环境中，img 的 src 请求无法携带 Authorization 头，导致文件下载接口返回 400。
 * 本组件通过 getFilePreview 获取带 token 的 preview_url，确保图片可正常显示。
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

  useEffect(() => {
    if (!fileUuid) {
      setLoading(false);
      setError(true);
      return;
    }

    let cancelled = false;

    getFileDownloadUrlWithToken(fileUuid, { forAvatar })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileUuid, forAvatar]);

  if (loading) {
    return (
      <div
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
        -
      </div>
    );
  }

  if (error || !src) {
    return (
      <span style={{ color: '#999', ...style }}>-</span>
    );
  }

  const previewConfig =
    typeof preview === 'object' ? { ...preview, src } : preview ? { src } : false;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 4, ...style }}
      preview={previewConfig}
      onError={(e) => {
        setError(true);
        onError?.(e);
      }}
      onLoad={onLoad}
    />
  );
};

export default SecureImage;
