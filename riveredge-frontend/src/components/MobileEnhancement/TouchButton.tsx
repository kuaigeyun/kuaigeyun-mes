/**
 * 触屏优化按钮组件
 *
 * 提供触屏优化的按钮，包括大尺寸、大字体、易于点击等。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import React from 'react';
import { Button } from 'antd';
import { InputOptimizer } from '@/utils/mobileEnhancement';
import type { ButtonProps } from 'antd';

/**
 * 触屏优化按钮组件属性
 */
export interface TouchButtonProps extends ButtonProps {
  /** 是否启用触屏优化 */
  touchOptimized?: boolean;
  /** 按钮大小（触屏模式下自动调整） */
  touchSize?: 'small' | 'medium' | 'large';
}

/**
 * 触屏优化按钮组件
 */
export const TouchButton: React.FC<TouchButtonProps> = ({
  touchOptimized = true,
  touchSize = 'medium',
  style,
  size,
  ...props
}) => {
  const touchStyle = touchOptimized
    ? InputOptimizer.getTouchButtonStyle()
    : {};

  // 触屏模式下，忽略size属性，使用touchSize
  const finalSize = touchOptimized ? undefined : size;

  return (
    <Button
      {...props}
      size={finalSize}
      style={{
        ...touchStyle,
        ...style,
      }}
    />
  );
};
