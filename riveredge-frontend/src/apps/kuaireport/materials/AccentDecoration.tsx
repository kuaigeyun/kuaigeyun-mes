import React from 'react';
import './materials.css';

export type AccentDecorationVariant = 'scanLine' | 'cornerMarks' | 'pulseBar';

export interface AccentDecorationProps {
  variant?: AccentDecorationVariant;
  animate?: boolean;
  style?: React.CSSProperties;
}

const accent = 'var(--kb-accent, #00d4ff)';

const ScanLine: React.FC<{ animate?: boolean }> = ({ animate }) => (
  <svg width="100%" height="100%" viewBox="0 0 240 28" preserveAspectRatio="none" style={{ display: 'block', minHeight: 28 }}>
    <polyline
      points="0,18 48,18 58,6 182,6 192,18 240,18"
      fill="none"
      stroke={accent}
      strokeWidth="2"
      className={animate ? 'kb-border-breathe' : undefined}
    />
    <rect x="108" y="10" width="24" height="8" fill={accent} opacity={0.55} className={animate ? 'kb-dot-pulse' : undefined} />
  </svg>
);

const CornerMarks: React.FC<{ animate?: boolean }> = ({ animate }) => {
  const marks: React.CSSProperties[] = [
    { top: 0, left: 0, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
    { top: 0, right: 0, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
    { bottom: 0, left: 0, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
    { bottom: 0, right: 0, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
  ];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 48 }}>
      {marks.map((style, i) => (
        <div
          key={i}
          className={animate ? 'kb-border-breathe' : undefined}
          style={{ position: 'absolute', width: 18, height: 18, ...style }}
        />
      ))}
    </div>
  );
};

const PulseBar: React.FC<{ animate?: boolean }> = ({ animate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minHeight: 24 }}>
    {Array.from({ length: 12 }).map((_, i) => (
      <div
        key={i}
        className={animate ? 'kb-dot-pulse' : undefined}
        style={{
          flex: 1,
          height: 4 + (i % 3) * 4,
          background: accent,
          opacity: 0.35 + (i % 4) * 0.15,
          borderRadius: 1,
          animationDelay: `${i * 0.12}s`,
        }}
      />
    ))}
  </div>
);

const AccentDecoration: React.FC<AccentDecorationProps> = ({
  variant = 'scanLine',
  animate = true,
  style,
}) => (
  <div style={{ width: '100%', ...style }}>
    {variant === 'scanLine' ? <ScanLine animate={animate} /> : null}
    {variant === 'cornerMarks' ? <CornerMarks animate={animate} /> : null}
    {variant === 'pulseBar' ? <PulseBar animate={animate} /> : null}
  </div>
);

export default AccentDecoration;
