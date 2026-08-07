import React, { useRef, useState } from 'react';
import { Tooltip } from 'antd';
import Lottie from 'lottie-react';
import assistAnimation from '../../static/lottie/assist.json';

type Props = {
  tooltip: string;
  onClick: () => void;
  isLightModeLightBg: boolean;
};

/** 顶栏 AI 入口：默认静态首帧，悬停时才播放 Lottie，避免全页持续动画掉帧 */
export const AiAssistantHeaderButton = React.memo(function AiAssistantHeaderButton({
  tooltip,
  onClick,
  isLightModeLightBg,
}: Props) {
  const lottieRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <Tooltip title={tooltip}>
      <span className="ai-assistant-lottie-btn-wrapper">
        <span
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === 'Enter' && onClick()}
          onMouseEnter={() => {
            setHovered(true);
            lottieRef.current?.play?.();
          }}
          onMouseLeave={() => {
            setHovered(false);
            lottieRef.current?.stop?.();
            lottieRef.current?.goToAndStop?.(0, true);
          }}
          className="ai-assistant-lottie-btn"
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={assistAnimation}
            loop={hovered}
            autoplay={false}
            style={{
              width: 52,
              height: 52,
              display: 'block',
              ...(!isLightModeLightBg
                ? {
                    filter:
                      'brightness(2) contrast(1.2) drop-shadow(0 0 6px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 16px rgba(255, 255, 255, 0.25))',
                  }
                : {}),
            }}
          />
        </span>
      </span>
    </Tooltip>
  );
});
