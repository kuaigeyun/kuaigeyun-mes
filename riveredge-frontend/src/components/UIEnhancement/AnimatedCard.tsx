/**
 * 动画卡片组件
 *
 * 提供带动画效果的卡片组件，提升用户体验。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import React from 'react';
import { Card } from 'antd';
import { AnimationHelper } from '@/utils/uiEnhancement';
import type { CardProps } from 'antd';

interface AnimatedCardProps extends CardProps {
  /** 动画类型 */
  animationType?: 'fadeIn' | 'slideIn' | 'scale' | 'none';
  /** 动画方向（仅slideIn有效） */
  animationDirection?: 'left' | 'right' | 'top' | 'bottom';
  /** 动画持续时间（毫秒） */
  animationDuration?: number;
  /** 是否启用悬停效果 */
  hoverable?: boolean;
}

/**
 * 动画卡片组件
 */
const AnimatedCard: React.FC<AnimatedCardProps> = ({
  animationType = 'fadeIn',
  animationDirection = 'right',
  animationDuration = 300,
  hoverable = true,
  style,
  ...props
}) => {
  const getAnimationStyle = (): React.CSSProperties => {
    switch (animationType) {
      case 'fadeIn':
        return AnimationHelper.getFadeInStyle(animationDuration);
      case 'slideIn':
        return AnimationHelper.getSlideInStyle(animationDirection, animationDuration);
      case 'scale':
        return AnimationHelper.getScaleStyle(animationDuration);
      default:
        return {};
    }
  };

  const mergedStyle: React.CSSProperties = {
    ...getAnimationStyle(),
    transition: hoverable ? 'all 0.3s ease' : undefined,
    ...style,
  };

  return (
    <Card
      {...props}
      hoverable={hoverable}
      style={mergedStyle}
    />
  );
};

export default AnimatedCard;
