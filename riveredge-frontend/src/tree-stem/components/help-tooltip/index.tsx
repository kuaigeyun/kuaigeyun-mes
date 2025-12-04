/**
 * 功能提示组件
 * 
 * 提供统一的 Tooltip 和 Popover 提示功能
 */

import React from 'react';
import { Tooltip, Popover, TooltipProps, PopoverProps } from 'antd';
import { QuestionCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

/**
 * 功能提示组件属性
 */
export interface HelpTooltipProps {
  /**
   * 提示内容
   */
  content: React.ReactNode;
  /**
   * 提示标题（Popover 模式）
   */
  title?: React.ReactNode;
  /**
   * 提示类型（tooltip 或 popover）
   */
  type?: 'tooltip' | 'popover';
  /**
   * 提示位置
   */
  placement?: TooltipProps['placement'] | PopoverProps['placement'];
  /**
   * 图标类型
   */
  iconType?: 'question' | 'info';
  /**
   * 自定义图标
   */
  icon?: React.ReactNode;
  /**
   * 图标颜色
   */
  iconColor?: string;
  /**
   * 图标大小
   */
  iconSize?: number;
  /**
   * 是否显示图标（默认 true）
   */
  showIcon?: boolean;
  /**
   * 自定义样式
   */
  style?: React.CSSProperties;
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 功能提示组件
 */
const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title,
  type = 'tooltip',
  placement = 'top',
  iconType = 'question',
  icon,
  iconColor = '#1890ff',
  iconSize = 14,
  showIcon = true,
  style,
  className,
}) => {
  const defaultIcon = iconType === 'question' ? <QuestionCircleOutlined /> : <InfoCircleOutlined />;
  const displayIcon = icon || defaultIcon;

  const iconElement = showIcon ? (
    <span
      style={{
        color: iconColor,
        fontSize: iconSize,
        cursor: 'help',
        marginLeft: 4,
        ...style,
      }}
      className={className}
    >
      {displayIcon}
    </span>
  ) : null;

  if (type === 'popover') {
    return (
      <Popover
        title={title}
        content={content}
        placement={placement as PopoverProps['placement']}
        trigger="hover"
      >
        {iconElement}
      </Popover>
    );
  }

  return (
    <Tooltip
      title={content}
      placement={placement as TooltipProps['placement']}
    >
      {iconElement}
    </Tooltip>
  );
};

/**
 * 字段提示组件（用于表单字段）
 */
export interface FieldHelpProps extends Omit<HelpTooltipProps, 'showIcon'> {
  /**
   * 字段标签
   */
  label: React.ReactNode;
  /**
   * 是否在标签后显示提示
   */
  showAfterLabel?: boolean;
}

/**
 * 字段提示组件
 */
export const FieldHelp: React.FC<FieldHelpProps> = ({
  label,
  content,
  showAfterLabel = true,
  ...tooltipProps
}) => {
  if (!showAfterLabel) {
    return <>{label}</>;
  }

  return (
    <span>
      {label}
      <HelpTooltip content={content} {...tooltipProps} />
    </span>
  );
};

export default HelpTooltip;

