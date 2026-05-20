/**
 * 全屏 / 居中页面加载：Lottie 动画（鉴权等待等；路由懒加载使用 PageSkeleton Spin）
 */
import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../../../static/lottie/loading.json';

export interface PageLoadingLottieProps {
  /** 动画边长（px） */
  size?: number;
  className?: string;
}

const PageLoadingLottie: React.FC<PageLoadingLottieProps> = ({ size = 120, className }) => (
  <Lottie
    className={className}
    animationData={loadingAnimation}
    loop
    style={{ width: size, height: size }}
  />
);

export default PageLoadingLottie;
