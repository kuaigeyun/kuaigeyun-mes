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
}

/**
 * 图片组件
 */
const ImageComponent: React.FC<ImageComponentProps> = ({ component }) => {
  const { src, alt, style } = component;

  return (
    <Image
      src={src}
      alt={alt}
      style={style}
      preview={false}
    />
  );
};

export default ImageComponent;

