/**
 * 触屏优化输入框组件
 *
 * 提供触屏优化的输入框，包括大字体、大尺寸、虚拟键盘支持等。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import React from 'react';
import { Input, InputNumber, Select } from 'antd';
import { InputOptimizer } from '@/utils/mobileEnhancement';
import type { InputProps, InputNumberProps, SelectProps } from 'antd';

/**
 * 触屏优化输入框组件属性
 */
export interface TouchInputProps extends InputProps {
  /** 是否启用触屏优化 */
  touchOptimized?: boolean;
}

/**
 * 触屏优化输入框组件
 */
export const TouchInput: React.FC<TouchInputProps> = ({
  touchOptimized = true,
  style,
  ...props
}) => {
  const touchStyle = touchOptimized
    ? InputOptimizer.getTouchInputStyle()
    : {};

  return (
    <Input
      {...props}
      style={{
        ...touchStyle,
        ...style,
      }}
    />
  );
};

/**
 * 触屏优化数字输入框组件属性
 */
export interface TouchInputNumberProps extends InputNumberProps {
  /** 是否启用触屏优化 */
  touchOptimized?: boolean;
}

/**
 * 触屏优化数字输入框组件
 */
export const TouchInputNumber: React.FC<TouchInputNumberProps> = ({
  touchOptimized = true,
  style,
  ...props
}) => {
  const touchStyle = touchOptimized
    ? InputOptimizer.getTouchInputStyle()
    : {};

  return (
    <InputNumber
      {...props}
      style={{
        ...touchStyle,
        ...style,
      }}
    />
  );
};

/**
 * 触屏优化选择框组件属性
 */
export interface TouchSelectProps extends SelectProps {
  /** 是否启用触屏优化 */
  touchOptimized?: boolean;
}

/**
 * 触屏优化选择框组件
 */
export const TouchSelect: React.FC<TouchSelectProps> = ({
  touchOptimized = true,
  style,
  ...props
}) => {
  const touchStyle = touchOptimized
    ? InputOptimizer.getTouchInputStyle()
    : {};

  return (
    <Select
      {...props}
      style={{
        ...touchStyle,
        ...style,
      }}
    />
  );
};
