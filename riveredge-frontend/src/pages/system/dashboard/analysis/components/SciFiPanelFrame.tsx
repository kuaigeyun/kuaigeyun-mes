import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../../../../hooks/usePrefersReducedMotion';

/**
 * 描边流光起点与走向（与 BusinessBoard 画圈一致）：
 * - `sw`：画布**右上角**锚定，向心扫（左列、中列底左「产线产出」）
 * - `se`：画布**左上角**锚定，向心扫（右列、中列底右「计划执行」）
 * - `east` / `west` / `ne` / `nw` / `center`：其它布局或通用卡片
 */
export type SciFiRimConverge = 'center' | 'east' | 'west' | 'ne' | 'nw' | 'se' | 'sw';

export interface SciFiPanelFrameProps {
  children: React.ReactNode;
  className?: string;
  /** 与卡片布局合并：flex、minHeight、flexShrink 等 */
  style?: React.CSSProperties;
  /**
   * 流光扫向（向心）：按布局传 east/west/ne/nw/se/sw；默认 center 为自中心单次扩散。
   */
  rimConverge?: SciFiRimConverge;
}

/** 须与下方 panelBase.borderRadius 一致 */
const PANEL_RADIUS_PX = 10;

/** 克制配色：冷灰底線 + 淡高光，不抢内容 */
const FRAME = {
  base: 'rgba(71, 85, 105, 0.38)',
  corner: 'rgba(148, 163, 184, 0.52)',
} as const;

/** 整段周期（含静止间隔）；数值越大整体越慢 */
const RIM_FLOW_DURATION_S = 58;
const STREAK_W = 86;

const panelBase: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.38) 0%, rgba(15, 23, 42, 0.62) 100%)',
  backdropFilter: 'blur(12px)',
  borderRadius: PANEL_RADIUS_PX,
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  padding: '16px',
  color: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
};

function clampCornerRadius(w: number, h: number, pad: number, desired: number): number {
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  if (innerW <= 0 || innerH <= 0) return 0;
  return Math.min(desired, innerW / 2, innerH / 2);
}

const RIM_CONVERGE_VALUES = new Set<SciFiRimConverge>([
  'center',
  'east',
  'west',
  'ne',
  'nw',
  'se',
  'sw',
]);

function normalizeRimConverge(v: SciFiRimConverge | undefined): SciFiRimConverge {
  if (v && RIM_CONVERGE_VALUES.has(v)) return v;
  return 'center';
}

/**
 * 卡片边框：双层描边 + 一道淡色流光（单向扫过 → 静默间隔 → 再播放）；无回扫、无呼吸叠加。
 */
export const SciFiPanelFrame: React.FC<SciFiPanelFrameProps> = ({
  children,
  className,
  style,
  rimConverge: rimConvergeProp = 'center',
}) => {
  const rimConverge = normalizeRimConverge(rimConvergeProp);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const reduceMotion = usePrefersReducedMotion();
  /** 仅 [a-zA-Z0-9_-]，避免 @keyframes / class 与 useId 特殊字符不兼容导致部分实例无动画 */
  const uid = useId()
    .replace(/:/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_') || 'sfp';
  const fidRim = `sfpRim-${uid}`;
  const fidMask = `sfpMask-${uid}`;
  const fidStreak = `sfpStreak-${uid}`;
  const streakAnimBase = `sfpStreak_${uid}`;
  const streakClass = `sfp-str-${rimConverge}-${uid}`;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const read = () => {
      const r = el.getBoundingClientRect();
      let nw = r.width;
      let nh = r.height;
      /* flex/grid 首帧 getBoundingClientRect 偶发为 0，导致整段 SVG 不挂载、无边框动效 */
      if (nw < 2 || nh < 2) {
        nw = el.offsetWidth;
        nh = el.offsetHeight;
      }
      if (nw < 2 || nh < 2) {
        nw = el.clientWidth;
        nh = el.clientHeight;
      }
      setBox({ w: Math.max(0, nw), h: Math.max(0, nh) });
    };

    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);

    let raf0 = 0;
    let raf1 = 0;
    raf0 = requestAnimationFrame(() => {
      read();
      raf1 = requestAnimationFrame(read);
    });
    const t0 = window.setTimeout(read, 0);
    const t1 = window.setTimeout(read, 100);
    const t2 = window.setTimeout(read, 400);
    const onResize = () => read();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf1);
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, []);

  const pad = 0.75;
  const { w, h } = box;
  const rx = clampCornerRadius(w, h, pad, PANEL_RADIUS_PX);
  const innerW = Math.max(0, w - pad * 2);
  const innerH = Math.max(0, h - pad * 2);

  const br = Math.min(rx + pad + 2, Math.max(pad + 4, w * 0.12));
  const bl = Math.min(rx + pad + 2, Math.max(pad + 4, h * 0.12));
  const cornerInset = 8;
  /** L 型肘部圆角：与卡片系统圆角 rx / PANEL_RADIUS 同尺度，且不超过臂长 */
  const cornerArcR = Math.max(
    1.1,
    Math.min(rx * 0.52, PANEL_RADIUS_PX * 0.52, br * 0.4, bl * 0.4),
  );
  const r = cornerArcR;

  const cornerPaths =
    w > 8 && h > 8
      ? (() => {
          const tlX = pad + cornerInset;
          const tlY = pad + cornerInset;
          const trX = w - pad - cornerInset;
          const trY = pad + cornerInset;
          const blX = pad + cornerInset;
          const blY = h - pad - cornerInset;
          const brX = w - pad - cornerInset;
          const brY = h - pad - cornerInset;
          return [
            /* 左上：沿左缘自下而上 → 弧 → 底边向右 */
            `M ${tlX} ${tlY + br} L ${tlX} ${tlY + r} A ${r} ${r} 0 0 1 ${tlX + r} ${tlY} L ${tlX + br} ${tlY}`,
            /* 右上：沿顶边自左而右 → 弧 → 右缘向下 */
            `M ${trX - br} ${trY} L ${trX - r} ${trY} A ${r} ${r} 0 0 1 ${trX} ${trY + r} L ${trX} ${trY + br}`,
            /* 左下：沿左缘自上而下 → 弧 → 底边向右（sweep 与左上对称呼应底边法线） */
            `M ${blX} ${blY - bl} L ${blX} ${blY - r} A ${r} ${r} 0 0 0 ${blX + r} ${blY} L ${blX + br} ${blY}`,
            /* 右下：沿底边自左而右（臂长同 br 与右上对称）→ 弧 → 右缘向上 */
            `M ${brX - br} ${brY} L ${brX - r} ${brY} A ${r} ${r} 0 0 0 ${brX} ${brY - r} L ${brX} ${brY - bl}`,
          ];
        })()
      : [];

  const showSvg = w >= 4 && h >= 4;
  const cx = pad + innerW / 2;
  const cy = pad + innerH / 2;
  const rPulseMax = Math.hypot(innerW / 2, innerH / 2) + 8;
  const diagSweep = Math.hypot(w, h) * 1.45;
  const bandSweep = Math.max(w, h) * 1.15;
  const margin = 72;
  const east0 = -margin;
  const east1 = w + margin;
  const west0 = margin;
  const west1 = -w - margin;
  const diag0 = -margin;
  const diag1 = diagSweep + margin;
  const isCenterRim = rimConverge === 'center';

  const cssVars = {
    ['--sfp-east0' as string]: `${east0}px`,
    ['--sfp-east1' as string]: `${east1}px`,
    ['--sfp-west0' as string]: `${west0}px`,
    ['--sfp-west1' as string]: `${west1}px`,
    ['--sfp-diag0' as string]: `${diag0}px`,
    ['--sfp-diag1' as string]: `${diag1}px`,
  } as React.CSSProperties;

  const streakRect = (
    <rect x={0} y={-bandSweep / 2} width={STREAK_W} height={bandSweep} fill={`url(#${fidStreak})`} />
  );

  const maskSweepChild =
    rimConverge === 'east' ? (
      <g transform={`translate(0, ${h / 2})`}>
        <g
          className={reduceMotion ? undefined : streakClass}
          style={{ transformOrigin: '0px 0px', ...(reduceMotion ? { opacity: 0 } : {}) }}
        >
          {streakRect}
        </g>
      </g>
    ) : rimConverge === 'west' ? (
      <g transform={`translate(${w}, ${h / 2})`}>
        <g
          className={reduceMotion ? undefined : streakClass}
          style={{ transformOrigin: '0px 0px', ...(reduceMotion ? { opacity: 0 } : {}) }}
        >
          {streakRect}
        </g>
      </g>
    ) : rimConverge === 'ne' ? (
      <g transform={`translate(0, ${h})`}>
        <g transform="rotate(-45)">
          <g
            className={reduceMotion ? undefined : streakClass}
            style={{ transformOrigin: '0px 0px', ...(reduceMotion ? { opacity: 0 } : {}) }}
          >
            {streakRect}
          </g>
        </g>
      </g>
    ) : rimConverge === 'nw' ? (
      <g transform={`translate(${w}, ${h})`}>
        <g transform="rotate(45)">
          <g
            className={reduceMotion ? undefined : streakClass}
            style={{ transformOrigin: '0px 0px', ...(reduceMotion ? { opacity: 0 } : {}) }}
          >
            {streakRect}
          </g>
        </g>
      </g>
    ) : rimConverge === 'se' ? (
      <g transform="rotate(45)">
        <g
          className={reduceMotion ? undefined : streakClass}
          style={{ transformOrigin: '0px 0px', ...(reduceMotion ? { opacity: 0 } : {}) }}
        >
          {streakRect}
        </g>
      </g>
    ) : rimConverge === 'sw' ? (
      <g transform={`translate(${w}, 0)`}>
        <g transform="rotate(135)">
          <g
            className={reduceMotion ? undefined : streakClass}
            style={{ transformOrigin: '0px 0px', ...(reduceMotion ? { opacity: 0 } : {}) }}
          >
            {streakRect}
          </g>
        </g>
      </g>
    ) : null;

  /** 单向扫过 → 淡出 → 末端停留（opacity=0）→ 瞬移回起点；全程无回扫 */
  const kfEast = `
    @keyframes ${streakAnimBase}_east {
      0%, 2% { transform: translate3d(var(--sfp-east0), 0, 0); opacity: 0; }
      4% { opacity: 0.9; }
      34% { transform: translate3d(var(--sfp-east1), 0, 0); opacity: 0.82; }
      36% { transform: translate3d(var(--sfp-east1), 0, 0); opacity: 0; }
      36%, 40% { transform: translate3d(var(--sfp-east1), 0, 0); opacity: 0; }
      40.02%, 100% { transform: translate3d(var(--sfp-east0), 0, 0); opacity: 0; }
    }
  `;
  const kfWest = `
    @keyframes ${streakAnimBase}_west {
      0%, 2% { transform: translate3d(var(--sfp-west0), 0, 0); opacity: 0; }
      4% { opacity: 0.9; }
      34% { transform: translate3d(var(--sfp-west1), 0, 0); opacity: 0.82; }
      36% { transform: translate3d(var(--sfp-west1), 0, 0); opacity: 0; }
      36%, 40% { transform: translate3d(var(--sfp-west1), 0, 0); opacity: 0; }
      40.02%, 100% { transform: translate3d(var(--sfp-west0), 0, 0); opacity: 0; }
    }
  `;
  const kfDiag = (name: string) => `
    @keyframes ${streakAnimBase}_${name} {
      0%, 2% { transform: translate3d(var(--sfp-diag0), 0, 0); opacity: 0; }
      4% { opacity: 0.9; }
      34% { transform: translate3d(var(--sfp-diag1), 0, 0); opacity: 0.82; }
      36% { transform: translate3d(var(--sfp-diag1), 0, 0); opacity: 0; }
      36%, 40% { transform: translate3d(var(--sfp-diag1), 0, 0); opacity: 0; }
      40.02%, 100% { transform: translate3d(var(--sfp-diag0), 0, 0); opacity: 0; }
    }
  `;
  const kfCenter = `
    @keyframes ${streakAnimBase}_center {
      0%, 2% { transform: scale(0.02); opacity: 0; }
      4% { opacity: 0.78; }
      34% { transform: scale(1); opacity: 0.7; }
      36% { transform: scale(1); opacity: 0; }
      36%, 40% { transform: scale(1); opacity: 0; }
      40.02%, 100% { transform: scale(0.02); opacity: 0; }
    }
  `;

  const flowEase = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const flowDur = `${RIM_FLOW_DURATION_S}s`;

  return (
    <div ref={wrapRef} className={className} style={{ ...panelBase, ...style }}>
      {showSvg && (
        <svg
          aria-hidden
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMinYMin meet"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
            zIndex: 0,
            ...cssVars,
          }}
        >
          <defs>
            <mask
              id={fidMask}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={w}
              height={h}
            >
              <rect x={0} y={0} width={w} height={h} fill="black" />
              {reduceMotion ? (
                <rect x={0} y={0} width={w} height={h} fill="white" fillOpacity={0.56} />
              ) : isCenterRim ? (
                <g transform={`translate(${cx}, ${cy})`}>
                  <g className={streakClass} style={{ transformOrigin: '0 0', transformBox: 'fill-box' }}>
                    <circle cx={0} cy={0} r={rPulseMax} fill="white" />
                  </g>
                </g>
              ) : (
                maskSweepChild
              )}
            </mask>
            <linearGradient id={fidStreak} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={STREAK_W} y2={0}>
              <stop offset="0%" stopColor="#fff" stopOpacity={0} />
              <stop offset="28%" stopColor="#f8fafc" stopOpacity={0.62} />
              <stop offset="72%" stopColor="#38bdf8" stopOpacity={0.78} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <radialGradient
              id={fidRim}
              gradientUnits="userSpaceOnUse"
              cx={cx}
              cy={cy}
              r={rPulseMax}
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.48} />
              <stop offset="48%" stopColor="#e0f2fe" stopOpacity={0.78} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.62} />
            </radialGradient>
          </defs>
          {/* style 放在 defs 外：部分引擎对 defs 内样式应用到 mask 子节点不稳定 */}
          <style>
            {`
                ${kfEast}
                ${kfWest}
                ${kfDiag('ne')}
                ${kfDiag('nw')}
                ${kfDiag('se')}
                ${kfDiag('sw')}
                ${kfCenter}
                .sfp-str-east-${uid} {
                  animation: ${streakAnimBase}_east ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                .sfp-str-west-${uid} {
                  animation: ${streakAnimBase}_west ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                .sfp-str-ne-${uid} {
                  animation: ${streakAnimBase}_ne ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                .sfp-str-nw-${uid} {
                  animation: ${streakAnimBase}_nw ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                .sfp-str-se-${uid} {
                  animation: ${streakAnimBase}_se ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                .sfp-str-sw-${uid} {
                  animation: ${streakAnimBase}_sw ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                .sfp-str-center-${uid} {
                  animation: ${streakAnimBase}_center ${flowDur} ${flowEase} infinite;
                  will-change: transform, opacity;
                }
                @media (prefers-reduced-motion: reduce) {
                  .sfp-str-east-${uid},
                  .sfp-str-west-${uid},
                  .sfp-str-ne-${uid},
                  .sfp-str-nw-${uid},
                  .sfp-str-se-${uid},
                  .sfp-str-sw-${uid},
                  .sfp-str-center-${uid} {
                    animation: none !important;
                    opacity: 1 !important;
                    transform: none !important;
                  }
                }
              `}
          </style>

          <rect
            x={pad}
            y={pad}
            width={innerW}
            height={innerH}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={FRAME.base}
            strokeWidth={0.9}
            vectorEffect="nonScalingStroke"
          />

          <rect
            x={pad}
            y={pad}
            width={innerW}
            height={innerH}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={`url(#${fidRim})`}
            strokeWidth={1.72}
            vectorEffect="nonScalingStroke"
            mask={`url(#${fidMask})`}
            opacity={reduceMotion ? 0.62 : 0.96}
          />

          <g
            fill="none"
            stroke={FRAME.corner}
            strokeWidth={1.15}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="nonScalingStroke"
          >
            {cornerPaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </svg>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
};
