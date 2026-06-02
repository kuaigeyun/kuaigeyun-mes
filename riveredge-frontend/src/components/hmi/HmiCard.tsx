import type { CardProps } from 'antd';
import { Card } from 'antd';
import { HMI_DESIGN_TOKENS } from '../layout-templates/constants';

export type HmiCardProps = CardProps & {
  /** 填满父容器高度（三栏面板） */
  fill?: boolean;
};

export function HmiCard({ fill, className, style, ...rest }: HmiCardProps) {
  return (
    <Card
      size="small"
      className={['hmi-card', fill ? 'hmi-card--fill' : undefined, className].filter(Boolean).join(' ')}
      style={{
        background: HMI_DESIGN_TOKENS.BG_CARD,
        border: HMI_DESIGN_TOKENS.CONTAINER_BORDER,
        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
        ...style,
      }}
      {...rest}
    />
  );
}
