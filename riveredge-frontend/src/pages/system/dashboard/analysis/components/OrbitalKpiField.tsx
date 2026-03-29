import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import type { KpiItem } from '../mockData';
import { KpiCard } from './KpiCard';
import { simulateKpiValueStep } from '../utils/kpiLiveSimulation';

const BoardHero3D = lazy(() => import('./BoardHero3D'));

const PLANET_COUNT = 8;

export const OrbitalKpiField: React.FC<{
  kpiItems: KpiItem[];
  t: TFunction;
  /** 全屏时略增大轨道半径，8 张指标卡更散开；非全屏与原先一致 */
  isFullscreen?: boolean;
}> = ({ kpiItems, t, isFullscreen = false }) => {
  const [liveItems, setLiveItems] = useState(() => kpiItems.slice(0, PLANET_COUNT).map((x) => ({ ...x })));

  useEffect(() => {
    setLiveItems(kpiItems.slice(0, PLANET_COUNT).map((x) => ({ ...x })));
  }, [kpiItems]);

  useEffect(() => {
    const tick = () => {
      setLiveItems((prev) => prev.map((it) => ({ ...it, value: simulateKpiValueStep(it) })));
    };
    const id = window.setInterval(tick, 7200 + Math.floor(Math.random() * 2400));
    return () => clearInterval(id);
  }, []);

  const orbitR = isFullscreen
    ? 'clamp(162px, 42.5vmin, 278px)'
    : 'clamp(140px, 35.5vmin, 232px)';

  return (
    <div
      className={`orbital-kpi-field${isFullscreen ? ' orbital-kpi-field--fullscreen' : ''}`}
      style={
        {
          '--orbit-r': orbitR,
          '--orbit-cy': '52%',
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 260,
          boxSizing: 'border-box',
          overflow: 'visible',
          isolation: 'isolate',
        } as React.CSSProperties
      }
    >
      <style>
        {`
          @keyframes orbitalRingDrift {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
          @keyframes orbitalRingDriftReverse {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(-360deg); }
          }
          @keyframes stellarPulse {
            0%, 100% { opacity: 0.88; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.97; transform: translate(-50%, -50%) scale(1.018); }
          }
          @keyframes kpiBreathMotion {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.005); }
          }
          @keyframes planetCardSheen {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.34; }
          }
          .orbital-kpi-field .kpi-planet-breath {
            animation: kpiBreathMotion 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: var(--planet-breath-delay, 0s);
            transform-origin: center center;
          }
          .orbital-kpi-field .kpi-planet-breath:hover {
            animation-play-state: paused;
          }
          .orbital-kpi-field .kpi-planet-breath:hover .kpi-planet-card {
            transform: scale(1.045);
          }
          .orbital-kpi-field .kpi-planet-card {
            position: relative;
            transition: transform 0.2s ease;
          }
          .orbital-kpi-field .kpi-planet-card::before {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            pointer-events: none;
            z-index: 0;
            background: linear-gradient(
              125deg,
              rgba(255, 255, 255, 0.14) 0%,
              transparent 42%,
              rgba(255, 255, 255, 0.05) 58%,
              transparent 100%
            );
            opacity: 0.24;
            animation: planetCardSheen 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: var(--planet-sheen-delay, 0s);
          }
          .orbital-kpi-field .kpi-planet-card > * {
            position: relative;
            z-index: 1;
          }
          .orbital-kpi-field .kpi-planet-breath:hover .kpi-planet-card::before {
            opacity: 0.44;
          }
          .orbital-kpi-field .orbit-ring {
            position: absolute;
            left: 50%;
            top: var(--orbit-cy, 50%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
            border: 1px dashed rgba(56, 189, 248, 0.14);
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.05);
          }
          .orbital-kpi-field .orbit-ring--outer {
            width: min(54%, 280px);
            aspect-ratio: 1;
            animation: orbitalRingDrift 180s linear infinite;
          }
          .orbital-kpi-field .orbit-ring--mid {
            width: min(44%, 228px);
            aspect-ratio: 1;
            border-color: rgba(125, 211, 252, 0.1);
            animation: orbitalRingDriftReverse 120s linear infinite;
          }
          .orbital-kpi-field .orbit-ring--inner {
            width: min(34%, 176px);
            aspect-ratio: 1;
            border-color: rgba(56, 189, 248, 0.09);
            border-style: dotted;
            animation: orbitalRingDrift 88s linear infinite;
          }
          .orbital-kpi-field--fullscreen .orbit-ring--outer {
            width: min(58%, 312px);
          }
          .orbital-kpi-field--fullscreen .orbit-ring--mid {
            width: min(48%, 256px);
          }
          .orbital-kpi-field--fullscreen .orbit-ring--inner {
            width: min(38%, 200px);
          }
          .orbital-kpi-field .orbital-stellar-core {
            animation: stellarPulse 11s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .orbital-kpi-field .orbit-ring--outer,
            .orbital-kpi-field .orbit-ring--mid,
            .orbital-kpi-field .orbit-ring--inner {
              animation: none !important;
            }
            .orbital-kpi-field .kpi-planet-breath {
              animation: none !important;
            }
            .orbital-kpi-field .kpi-planet-card::before {
              animation: none !important;
              opacity: 0.22;
            }
            .orbital-kpi-field .orbital-stellar-core {
              animation: none !important;
              opacity: 0.92;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}
      </style>

      <div className="orbit-ring orbit-ring--outer" />
      <div className="orbit-ring orbit-ring--mid" />
      <div className="orbit-ring orbit-ring--inner" />

      <div
        className="orbital-stellar-core"
        style={{
          position: 'absolute',
          left: '50%',
          top: 'var(--orbit-cy, 50%)',
          width: 'min(44vmin, 280px)',
          height: 'min(44vmin, 280px)',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(34, 211, 238, 0.07) 28%, rgba(15, 23, 42, 0) 68%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 'var(--orbit-cy, 50%)',
          width: 'min(22vmin, 128px)',
          height: 'min(22vmin, 128px)',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* 正方形视口：高用 min(vmin,100%)，宽由 aspect-ratio 推导，避免「宽扁」画布导致 3D 上下被透视裁切 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 'var(--orbit-cy, 50%)',
          transform: 'translate(-50%, -50%)',
          height: 'min(46vmin, 92%)',
          width: 'auto',
          aspectRatio: '1',
          maxWidth: '100%',
          maxHeight: '100%',
          zIndex: 2,
          background: 'transparent',
          border: 'none',
          padding: 0,
          overflow: 'visible',
          boxSizing: 'border-box',
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                fontSize: 12,
              }}
            >
              3D…
            </div>
          }
        >
          <BoardHero3D />
        </Suspense>
      </div>

      {liveItems.map((item, i) => {
        const angle = -90 + i * (360 / PLANET_COUNT);
        return (
          <div
            key={item.id}
            style={
              {
                position: 'absolute',
                left: '50%',
                top: 'var(--orbit-cy, 50%)',
                width: 'clamp(92px, 18vw, 124px)',
                zIndex: 4,
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * var(--orbit-r))) rotate(${-angle}deg)`,
                ['--planet-breath-delay' as string]: `${i * 0.55}s`,
                ['--planet-sheen-delay' as string]: `${i * 0.45}s`,
              } as React.CSSProperties
            }
          >
            <div className="kpi-planet-breath">
              <KpiCard item={item} t={t} orbital />
            </div>
          </div>
        );
      })}
    </div>
  );
};
