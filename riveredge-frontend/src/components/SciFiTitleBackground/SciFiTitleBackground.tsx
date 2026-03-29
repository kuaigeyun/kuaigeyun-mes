import React, { useId, useMemo } from 'react';

export interface SciFiTitleBackgroundProps {
  className?: string;
  style?: React.CSSProperties;
  /** 条带高度；默认 `100%` 适合放在 `position:absolute; inset:0` 的 header 内 */
  height?: number | string;
  minHeight?: number;
}

/**
 * 纯 SVG 科幻风标题条背景：底光带、中心微光、两侧淡洗光与向中心渐隐的细线、标题旁数据条。
 * 两侧刻意极简，避免电路线/多边形切块带来的杂乱感。
 */
export const SciFiTitleBackground: React.FC<SciFiTitleBackgroundProps> = ({
  className,
  style,
  height = '100%',
  minHeight = 64,
}) => {
  const reactId = useId().replace(/:/g, '');
  const gid = useMemo(
    () => ({
      titleBg: `${reactId}-sciFiTitleBg`,
      sideWashL: `${reactId}-sciFiSideWashL`,
      sideWashR: `${reactId}-sciFiSideWashR`,
      sideHairL: `${reactId}-sciFiSideHairL`,
      sideHairR: `${reactId}-sciFiSideHairR`,
      bottomLine: `${reactId}-sciFiBottomLine`,
      centerGlow: `${reactId}-sciFiCenterGlow`,
      softGlow: `${reactId}-sciFiSoftGlow`,
    }),
    [reactId]
  );

  return (
    <svg
      className={className}
      style={{ display: 'block', width: '100%', height, minHeight, ...style }}
      viewBox="0 0 1200 72"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid.titleBg} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0c1929" />
          <stop offset="45%" stopColor="#071018" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={gid.sideWashL} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.09} />
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity={0.02} />
          <stop offset="100%" stopColor="#020617" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={gid.sideWashR} x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.09} />
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity={0.02} />
          <stop offset="100%" stopColor="#020617" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={gid.sideHairL} x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.42} />
          <stop offset="45%" stopColor="#38bdf8" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={gid.sideHairR} x1="1200" y1="0" x2="940" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.42} />
          <stop offset="45%" stopColor="#38bdf8" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={gid.bottomLine} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0} />
          <stop offset="15%" stopColor="#38bdf8" stopOpacity={0.25} />
          <stop offset="50%" stopColor="#e0f2fe" stopOpacity={0.85} />
          <stop offset="85%" stopColor="#38bdf8" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={gid.centerGlow} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.22} />
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity={0.06} />
          <stop offset="100%" stopColor="#020617" stopOpacity={0} />
        </radialGradient>
        <filter id={gid.softGlow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>
          {`
          /* 标题条：长周期 + 小幅度起伏，接近 MD3 环境动效节奏，避免抢眼 */
          @keyframes sciFiTitleBottomBreath {
            0%, 100% { opacity: 0.52; }
            50% { opacity: 0.78; }
          }
          @keyframes sciFiTitleCenterBreath {
            0%, 100% { opacity: 0.72; }
            50% { opacity: 0.9; }
          }
          @keyframes sciFiBarPulse {
            0%, 100% { opacity: 0.42; }
            50% { opacity: 0.68; }
          }
          .sci-fi-title-bottom {
            animation: sciFiTitleBottomBreath 6.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          .sci-fi-title-center {
            animation: sciFiTitleCenterBreath 7.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          .sci-fi-bar-a { animation: sciFiBarPulse 4.2s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: 0s; }
          .sci-fi-bar-b { animation: sciFiBarPulse 4.2s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: 0.4s; }
          .sci-fi-bar-c { animation: sciFiBarPulse 4.2s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: 0.8s; }
          .sci-fi-bar-d { animation: sciFiBarPulse 4.2s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: 1.2s; }
          @media (prefers-reduced-motion: reduce) {
            .sci-fi-title-bottom,
            .sci-fi-title-center,
            .sci-fi-bar-a,
            .sci-fi-bar-b,
            .sci-fi-bar-c,
            .sci-fi-bar-d {
              animation: none !important;
            }
            .sci-fi-title-bottom { opacity: 0.62; }
            .sci-fi-title-center { opacity: 0.8; }
            .sci-fi-bar-a, .sci-fi-bar-b, .sci-fi-bar-c, .sci-fi-bar-d { opacity: 0.52; }
          }
        `}
        </style>
      </defs>

      <rect width="1200" height="72" fill={`url(#${gid.titleBg})`} />

      <ellipse
        className="sci-fi-title-center"
        cx="600"
        cy="38"
        rx="220"
        ry="26"
        fill={`url(#${gid.centerGlow})`}
      />

      {/* 两侧：极淡洗光 + 向中心消隐的细线（无折线/切块） */}
      <rect x="0" y="0" width="168" height="72" fill={`url(#${gid.sideWashL})`} />
      <rect x="1032" y="0" width="168" height="72" fill={`url(#${gid.sideWashR})`} />
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        <line x1="0" y1="34" x2="248" y2="34" stroke={`url(#${gid.sideHairL})`} strokeWidth={0.9} opacity={0.85} />
        <line x1="0" y1="42" x2="200" y2="42" stroke={`url(#${gid.sideHairL})`} strokeWidth={0.55} opacity={0.55} />
        <line x1="1200" y1="34" x2="952" y2="34" stroke={`url(#${gid.sideHairR})`} strokeWidth={0.9} opacity={0.85} />
        <line x1="1200" y1="42" x2="1000" y2="42" stroke={`url(#${gid.sideHairR})`} strokeWidth={0.55} opacity={0.55} />
      </g>

      <g fill="#38bdf8" opacity={0.5}>
        <rect className="sci-fi-bar-a" x="462" y="28" width="3" height="18" rx="0.5" />
        <rect className="sci-fi-bar-b" x="468" y="22" width="3" height="24" rx="0.5" />
        <rect className="sci-fi-bar-c" x="474" y="26" width="3" height="20" rx="0.5" />
        <rect className="sci-fi-bar-d" x="480" y="30" width="3" height="16" rx="0.5" />
      </g>
      <g fill="#38bdf8" opacity={0.5}>
        <rect className="sci-fi-bar-d" x="714" y="28" width="3" height="18" rx="0.5" />
        <rect className="sci-fi-bar-c" x="720" y="22" width="3" height="24" rx="0.5" />
        <rect className="sci-fi-bar-b" x="726" y="26" width="3" height="20" rx="0.5" />
        <rect className="sci-fi-bar-a" x="732" y="30" width="3" height="16" rx="0.5" />
      </g>

      <line
        className="sci-fi-title-bottom"
        x1="0"
        y1="69.5"
        x2="1200"
        y2="69.5"
        stroke={`url(#${gid.bottomLine})`}
        strokeWidth={1.25}
        filter={`url(#${gid.softGlow})`}
      />
      <line
        x1="0"
        y1="70.5"
        x2="1200"
        y2="70.5"
        stroke="#0ea5e9"
        strokeOpacity={0.12}
        strokeWidth={2}
      />
    </svg>
  );
};
