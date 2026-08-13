import React, { useRef } from 'react';
import { Tooltip } from 'antd';
import Lottie from 'lottie-react';
import assistAnimation from '../../static/lottie/assist.json';

type Props = {
  tooltip: string;
  onClick: () => void;
  /** 深色/彩色顶栏：浅色实心圆底，避免紫黑耳机融进海军蓝 */
  isDarkHeader?: boolean;
};

/** 顶栏 AI 入口：默认静态首帧，悬停时从第 0 帧重播，离开停回首帧 */
export const AiAssistantHeaderButton = React.memo(function AiAssistantHeaderButton({
  tooltip,
  onClick,
  isDarkHeader = false,
}: Props) {
  const lottieRef = useRef<any>(null);

  return (
    <Tooltip title={tooltip}>
      <span className="ai-assistant-lottie-btn-wrapper">
        <span
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === 'Enter' && onClick()}
          onMouseEnter={() => {
            lottieRef.current?.goToAndPlay?.(0, true);
          }}
          onMouseLeave={() => {
            lottieRef.current?.goToAndStop?.(0, true);
          }}
          className={
            isDarkHeader ? 'ai-assistant-lottie-btn ai-assistant-lottie-btn--dark-header' : 'ai-assistant-lottie-btn'
          }
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={assistAnimation}
            loop
            autoplay={false}
            style={{
              width: 54,
              height: 54,
              display: 'block',
              opacity: 1,
            }}
          />
        </span>
      </span>
    </Tooltip>
  );
});
