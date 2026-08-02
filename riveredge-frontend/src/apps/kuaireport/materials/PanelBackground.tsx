import React from 'react';

export type BackgroundVariant = 'radialGrid' | 'panelWash' | 'deepVoid';

export interface PanelBackgroundProps {
  variant?: BackgroundVariant;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  fullHeight?: boolean;
}

function backgroundFor(variant: BackgroundVariant): string {
  const bg = 'var(--kb-bg, #050a12)';
  const grid = 'var(--kb-grid-line, rgba(0, 160, 255, 0.06))';
  const accentSoft = 'var(--kb-accent-soft, rgba(0, 212, 255, 0.35))';

  switch (variant) {
    case 'panelWash':
      return `linear-gradient(180deg, rgba(0, 40, 80, 0.45), transparent 40%), ${bg}`;
    case 'deepVoid':
      return `radial-gradient(ellipse at 50% 0%, rgba(0, 80, 140, 0.35), transparent 55%), ${bg}`;
    case 'radialGrid':
    default:
      return [
        `linear-gradient(${grid} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
        `radial-gradient(ellipse at 30% 20%, ${accentSoft}, transparent 45%)`,
        bg,
      ].join(', ');
  }
}

const PanelBackground: React.FC<PanelBackgroundProps> = ({
  variant = 'radialGrid',
  children,
  style,
  fullHeight = true,
}) => {
  const isGrid = variant === 'radialGrid';
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: fullHeight ? '100%' : undefined,
        height: fullHeight ? '100%' : undefined,
        background: backgroundFor(variant),
        backgroundSize: isGrid ? '40px 40px, 40px 40px, auto, auto' : undefined,
        color: 'var(--kb-text, rgba(255,255,255,0.92))',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default PanelBackground;
