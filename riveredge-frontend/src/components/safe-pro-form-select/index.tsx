/**
 * 安全的 ProFormSelect 组件包装器
 *
 * 确保 options 属性始终是数组，避免 "options.map is not a function" 错误
 * 特别处理认证失败、网络错误、数据异常等各种情况
 *
 * 主要解决的问题：
 * 1. options.map is not a function 错误
 * 2. 认证失败时的数据处理
 * 3. API返回异常数据时的降级处理
 * 4. 组件渲染错误时的容错处理
 */

import React from 'react';
import { ProFormSelect } from '@ant-design/pro-components';

/**
 * 安全处理 options 的工具函数
 * 处理各种可能的错误情况：undefined、null、非数组等
 */
const safeOptions = (options: any, componentName: string = 'ProFormSelect'): any[] => {
  // 如果 options 是 undefined 或 null，返回空数组
  if (options == null) {
    return [];
  }

  // 如果已经是数组，直接返回
  if (Array.isArray(options)) {
    return options;
  }

  // 处理其他异常情况（仅在开发环境输出警告）
  if (import.meta.env.DEV) {
    console.warn(`${componentName}: options 不是数组类型:`, {
      options,
      type: typeof options,
    });
  }

  // 尝试转换对象为数组（某些情况下后端可能返回对象）
  if (typeof options === 'object') {
    // 如果是类数组对象，尝试转换
    if (options.length !== undefined) {
      try {
        return Array.from(options);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(`${componentName}: 无法转换对象为数组:`, e);
        }
      }
    }

    // 如果是普通对象，尝试提取值作为数组
    const values = Object.values(options);
    if (values.length > 0 && Array.isArray(values[0])) {
      return values[0] as any[];
    }
  }

  // 所有其他情况返回空数组
  return [];
};

/**
 * 安全处理 fieldProps 中 options 的工具函数
 */
const safeFieldProps = (fieldProps: any, componentName: string = 'ProFormSelect'): any => {
  if (!fieldProps) return fieldProps;

  const safeProps = { ...fieldProps };
  if (fieldProps.options !== undefined) {
    safeProps.options = safeOptions(fieldProps.options, `${componentName}.fieldProps`);
  }
  return safeProps;
};

/**
 * 安全的 ProFormSelect 组件
 *
 * 自动确保 options 和 fieldProps.options 始终是数组
 * 特别处理认证失败、网络错误等异常情况
 */
const SafeProFormSelect: React.FC<any> = (props) => {
  const safeProps = { ...props };

  // 处理直接的 options 属性
  if (props.options !== undefined) {
    safeProps.options = safeOptions(props.options, 'SafeProFormSelect');
  }

  // 处理 fieldProps 中的 options 属性
  if (props.fieldProps) {
    safeProps.fieldProps = safeFieldProps(props.fieldProps, 'SafeProFormSelect');
  }

  // 添加错误边界处理
  try {
    return <ProFormSelect {...safeProps} />;
  } catch (error) {
    console.error('SafeProFormSelect 渲染错误:', error, {
      props: safeProps,
      originalProps: props,
      errorStack: error instanceof Error ? error.stack : 'Unknown error'
    });

    // 发生错误时返回一个禁用的选择器，避免页面崩溃
    return (
      <ProFormSelect
        {...safeProps}
        options={[]}
        disabled={true}
        placeholder="数据加载失败"
      />
    );
  }
};

export default SafeProFormSelect;
