/**
 * 图片组件
 *
 * 支持图片上传和显示
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { Image } from 'antd';
import { ReportComponent } from '../index';

/**
 * 图片组件Props
 */
export interface ImageComponentProps {
  component: ReportComponent;
  data?: Record<string, any>;
}

/**
 * 图片组件
 */
const ImageComponent: React.FC<ImageComponentProps> = ({ component, data = {} }) => {
  const { src, alt, style } = component;

  // 变量替换
  const resolvedSrc = React.useMemo(() => {
    if (!src) return '';
    return src.replace(/\{\{([\w.]+)\}\}/g, (_: string, key: string) => {
      const keys = key.split('.');
      let value = data;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }, [src, data]);

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      style={style}
      preview={false}
    />
  );
};

export default ImageComponent;

