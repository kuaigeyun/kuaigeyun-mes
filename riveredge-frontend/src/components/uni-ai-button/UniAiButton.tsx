/**
 * uni-ai-button — 统一 AI 入口按钮
 *
 * 多彩渐变背景 + static/lottie/ai.json 动画图标，供 KU-AI 及各类 AI 能力入口复用。
 */

import React from 'react';
import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import aiAnimation from '../../../static/lottie/ai.json';
import { UniAiLottieIcon } from './UniAiLottieIcon';
import './index.less';

export interface UniAiButtonProps extends Omit<ButtonProps, 'icon' | 'type'> {
  /** Lottie 图标边长（px），默认 20 */
  iconSize?: number;
  /** 是否显示左侧 AI Lottie 图标，默认 true */
  showIcon?: boolean;
  /** 自定义 Lottie 动画数据，默认 static/lottie/ai.json */
  animationData?: object;
}

export const UniAiButton: React.FC<UniAiButtonProps> = ({
  iconSize = 20,
  showIcon = true,
  animationData = aiAnimation,
  className,
  children,
  ...rest
}) => {
  const mergedClassName = className ? `uni-ai-btn ${className}` : 'uni-ai-btn';

  const icon = showIcon ? (
    <UniAiLottieIcon
      size={iconSize}
      animationData={animationData}
      className="uni-ai-btn__icon"
    />
  ) : undefined;

  return (
    <Button type="default" className={mergedClassName} icon={icon} {...rest}>
      {children}
    </Button>
  );
};

export default UniAiButton;
