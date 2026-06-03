import type { CardProps } from 'antd';
import type { CSSProperties } from 'react';
import { HMI_DESIGN_TOKENS } from '../../theme/hmi/design';

export type TouchCardOptions = {
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function touchCardProps({
  fill,
  className,
  style,
}: TouchCardOptions = {}): Pick<CardProps, 'size' | 'className' | 'style'> {
  return {
    size: 'small',
    className: ['hmi-card', fill ? 'hmi-card--fill' : undefined, className].filter(Boolean).join(' '),
    style: {
      background: HMI_DESIGN_TOKENS.BG_CARD,
      border: HMI_DESIGN_TOKENS.CONTAINER_BORDER,
      borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
      ...style,
    },
  };
}
