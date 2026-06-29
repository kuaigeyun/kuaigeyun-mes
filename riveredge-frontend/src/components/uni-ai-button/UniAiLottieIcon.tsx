/**
 * uni-ai-button — AI Lottie 图标（按钮 / 抽屉标题等复用）
 */

import React from 'react';
import Lottie from 'lottie-react';
import aiAnimation from '../../../static/lottie/ai.json';
import './index.less';

export interface UniAiLottieIconProps {
  /** 边长（px），默认 20 */
  size?: number;
  /** 自定义 Lottie 动画数据，默认 static/lottie/ai.json */
  animationData?: object;
  className?: string;
}

export const UniAiLottieIcon: React.FC<UniAiLottieIconProps> = ({
  size = 20,
  animationData = aiAnimation,
  className,
}) => (
  <span
    className={className ?? 'uni-ai-lottie-icon'}
    style={{ width: size, height: size }}
  >
    <Lottie
      animationData={animationData}
      loop
      autoplay
      style={{ width: size, height: size, display: 'block' }}
    />
  </span>
);

export default UniAiLottieIcon;
