import React from 'react';
import './materials.css';

export type BorderVariant = 'corner' | 'double' | 'gradient' | 'titleEmbed';

export interface BorderPanelProps {
  variant?: BorderVariant;
  title?: string;
  animate?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  minHeight?: number | string;
}

const accent = 'var(--kb-accent, #00d4ff)';
const panel = 'var(--kb-panel, rgba(8, 22, 40, 0.72))';
const border = 'var(--kb-panel-border, rgba(0, 180, 255, 0.28))';

/** 角标科技边框 */
const CornerBorder: React.FC<{ animate?: boolean; children?: React.ReactNode }> = ({ animate, children }) => (
  <div
    className="kb-panel-shell"
    style={{
      background: panel,
      border: `1px solid ${border}`,
    }}
  >
    {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => {
      const styles: React.CSSProperties = {
        position: 'absolute',
        width: 14,
        height: 14,
        pointerEvents: 'none',
        zIndex: 2,
      };
      if (pos === 'tl') Object.assign(styles, { top: -1, left: -1, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` });
      if (pos === 'tr') Object.assign(styles, { top: -1, right: -1, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` });
      if (pos === 'bl') Object.assign(styles, { bottom: -1, left: -1, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` });
      if (pos === 'br') Object.assign(styles, { bottom: -1, right: -1, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` });
      return <div key={pos} className={animate ? 'kb-border-breathe' : undefined} style={styles} />;
    })}
    <div className="kb-panel-content">{children}</div>
  </div>
);

/** 双线内嵌边框 */
const DoubleBorder: React.FC<{ animate?: boolean; children?: React.ReactNode }> = ({ animate, children }) => (
  <div
    className="kb-panel-shell"
    style={{
      padding: 4,
      background: panel,
      border: `1px solid ${border}`,
    }}
  >
    <div
      className={animate ? 'kb-border-breathe' : undefined}
      style={{
        height: '100%',
        border: `1px solid ${accent}`,
        opacity: 0.85,
        boxSizing: 'border-box',
      }}
    >
      <div className="kb-panel-content">{children}</div>
    </div>
  </div>
);

/** 渐变描边边框 */
const GradientBorder: React.FC<{ animate?: boolean; children?: React.ReactNode }> = ({ animate, children }) => (
  <div
    className={`kb-panel-shell ${animate ? 'kb-border-breathe' : ''}`}
    style={{
      borderRadius: 6,
      padding: 2,
      background: `linear-gradient(135deg, ${accent}, #1864ff 45%, rgba(0,80,160,0.4))`,
    }}
  >
    <div
      style={{
        height: '100%',
        borderRadius: 4,
        background: 'var(--kb-bg, #050a12)',
        boxSizing: 'border-box',
      }}
    >
      <div className="kb-panel-content">{children}</div>
    </div>
  </div>
);

/** 顶部标题嵌入边框 */
const TitleEmbedBorder: React.FC<{ title?: string; animate?: boolean; children?: React.ReactNode }> = ({
  title,
  animate,
  children,
}) => (
  <div
    className="kb-panel-shell"
    style={{
      background: panel,
      border: `1px solid ${border}`,
      paddingTop: title ? 10 : 0,
    }}
  >
    {title ? (
      <div
        style={{
          position: 'absolute',
          top: -1,
          left: 16,
          padding: '0 10px',
          background: 'var(--kb-bg, #050a12)',
          color: accent,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1,
          lineHeight: '20px',
          zIndex: 3,
        }}
      >
        <span className={animate ? 'kb-dot-pulse' : undefined} style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: accent,
          marginRight: 8,
          verticalAlign: 'middle',
        }} />
        {title}
      </div>
    ) : null}
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} preserveAspectRatio="none">
      <polyline
        points="0,18 0,0 18,0"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        className={animate ? 'kb-border-breathe' : undefined}
      />
      <polyline
        points="100%,18 100%,0 82%,0"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        style={{ transform: 'translateX(0)' }}
      />
    </svg>
    <div className="kb-panel-content" style={{ paddingTop: title ? 16 : 12 }}>
      {children}
    </div>
  </div>
);

const BorderPanel: React.FC<BorderPanelProps> = ({
  variant = 'corner',
  title,
  animate = true,
  children,
  style,
  minHeight = 120,
}) => {
  const wrapStyle: React.CSSProperties = { minHeight, ...style };
  const body = (() => {
    switch (variant) {
      case 'double':
        return <DoubleBorder animate={animate}>{children}</DoubleBorder>;
      case 'gradient':
        return <GradientBorder animate={animate}>{children}</GradientBorder>;
      case 'titleEmbed':
        return (
          <TitleEmbedBorder title={title} animate={animate}>
            {children}
          </TitleEmbedBorder>
        );
      case 'corner':
      default:
        return <CornerBorder animate={animate}>{children}</CornerBorder>;
    }
  })();

  return <div style={wrapStyle}>{body}</div>;
};

export default BorderPanel;
