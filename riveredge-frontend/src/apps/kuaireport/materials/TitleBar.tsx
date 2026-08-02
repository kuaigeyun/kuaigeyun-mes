import React from 'react';
import './materials.css';

export type TitleBarVariant = 'accentBar' | 'techLine' | 'badgeCenter';

export interface TitleBarProps {
  variant?: TitleBarVariant;
  title?: string;
  subtitle?: string;
  animate?: boolean;
  style?: React.CSSProperties;
}

const accent = 'var(--kb-accent, #00d4ff)';
const text = 'var(--kb-text, rgba(255,255,255,0.92))';
const muted = 'var(--kb-text-muted, rgba(255,255,255,0.55))';

/** 左侧色条标题 */
const AccentBarTitle: React.FC<TitleBarProps> = ({ title, subtitle, animate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 40 }}>
    <div
      className={animate ? 'kb-border-breathe' : undefined}
      style={{ width: 4, alignSelf: 'stretch', minHeight: 28, background: accent, borderRadius: 2 }}
    />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: text, fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1.2 }}>{title}</div>
      {subtitle ? <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  </div>
);

/** 科技折线标题 */
const TechLineTitle: React.FC<TitleBarProps> = ({ title, subtitle, animate }) => (
  <div style={{ width: '100%', minHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="56" height="20" viewBox="0 0 56 20" style={{ flexShrink: 0 }}>
        <polyline
          points="0,16 14,16 20,4 36,4 42,16 56,16"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          className={animate ? 'kb-border-breathe' : undefined}
        />
        <circle cx="28" cy="4" r="2.5" fill={accent} className={animate ? 'kb-dot-pulse' : undefined} />
      </svg>
      <div style={{ color: text, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>{title}</div>
      <svg width="56" height="20" viewBox="0 0 56 20" style={{ flexShrink: 0, transform: 'scaleX(-1)' }}>
        <polyline points="0,16 14,16 20,4 36,4 42,16 56,16" fill="none" stroke={accent} strokeWidth="2" />
      </svg>
    </div>
    {subtitle ? <div style={{ color: muted, fontSize: 12, marginTop: 6, paddingLeft: 68 }}>{subtitle}</div> : null}
  </div>
);

/** 居中徽章标题 */
const BadgeCenterTitle: React.FC<TitleBarProps> = ({ title, subtitle, animate }) => (
  <div style={{ width: '100%', minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 20px',
        border: `1px solid ${accent}`,
        background: 'linear-gradient(180deg, rgba(0,180,255,0.18), rgba(0,40,80,0.1))',
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%)',
      }}
    >
      <span
        className={animate ? 'kb-dot-pulse' : undefined}
        style={{ width: 6, height: 6, borderRadius: '50%', background: accent }}
      />
      <span style={{ color: text, fontSize: 16, fontWeight: 700, letterSpacing: 3 }}>{title}</span>
      <span
        className={animate ? 'kb-dot-pulse' : undefined}
        style={{ width: 6, height: 6, borderRadius: '50%', background: accent }}
      />
    </div>
    {subtitle ? <div style={{ color: muted, fontSize: 12, marginTop: 8 }}>{subtitle}</div> : null}
  </div>
);

const TitleBar: React.FC<TitleBarProps> = ({
  variant = 'accentBar',
  title = '看板标题',
  subtitle,
  animate = true,
  style,
}) => {
  const props = { title, subtitle, animate };
  return (
    <div style={{ width: '100%', ...style }}>
      {variant === 'techLine' ? <TechLineTitle {...props} /> : null}
      {variant === 'badgeCenter' ? <BadgeCenterTitle {...props} /> : null}
      {variant === 'accentBar' ? <AccentBarTitle {...props} /> : null}
    </div>
  );
};

export default TitleBar;
