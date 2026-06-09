/**
 * 全屏 Lottie 加载（static/lottie/loading.json）
 * 用于登录鉴权、跳转首页、首屏 lazy 路由等全屏等待；inline Spin 仍用 antd 原生动画。
 */
import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../../../static/lottie/loading.json';

export interface PageLoadingLottieProps {
  /** 动画边长（px） */
  size?: number;
  className?: string;
}

/** 全屏居中 Lottie（登录 → 工作台唯一加载态） */
export const PageLoadingFullscreen: React.FC<{ size?: number }> = ({ size = 128 }) => (
    <div
      className="page-loading-fullscreen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <PageLoadingLottie size={size} />
    </div>
);

const PageLoadingLottie: React.FC<PageLoadingLottieProps> = ({ size = 120, className }) => (
  <Lottie
    className={className}
    animationData={loadingAnimation}
    loop
    style={{ width: size, height: size }}
  />
);

export default PageLoadingLottie;
