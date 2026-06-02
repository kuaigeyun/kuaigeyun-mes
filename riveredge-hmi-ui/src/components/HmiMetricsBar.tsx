import type { CSSProperties, ReactNode } from 'react';
import { Progress, Typography } from 'antd';
import { HMI_DESIGN_TOKENS } from '../tokens/design';
import { HMI_STATION_LAYOUT } from '../tokens/layout';

const { Text, Title } = Typography;

export interface HmiMetricsBarProps {
  plannedQty: number;
  completedQty: number;
  unqualifiedQty: number;
  workOrderCode?: string;
  height?: number;
}

export function HmiMetricsBar({
  plannedQty,
  completedQty,
  unqualifiedQty,
  workOrderCode,
  height = HMI_STATION_LAYOUT.METRICS_HEIGHT,
}: HmiMetricsBarProps) {
  const pct = plannedQty > 0 ? Math.min(100, Math.round((completedQty / plannedQty) * 100)) : 0;

  return (
    <div className="hmi-metrics-bar" style={{ height }}>
      <Metric label="计划" value={plannedQty} />
      <Metric label="完成" value={completedQty} color={HMI_DESIGN_TOKENS.STATUS_OK} />
      <Metric label="不良" value={unqualifiedQty} color={HMI_DESIGN_TOKENS.STATUS_ALARM} />
      <Metric label="工单" value={workOrderCode || '—'} isText />
      <div className="hmi-metrics-bar__progress">
        <Text className="hmi-metrics-bar__label">进度 </Text>
        <Progress percent={pct} strokeColor={HMI_DESIGN_TOKENS.STATUS_INFO} showInfo strokeWidth={10} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  color?: string;
  isText?: boolean;
}) {
  return (
    <div className="hmi-metrics-bar__item">
      <Text className="hmi-metrics-bar__label">{label}</Text>
      <div>
        {isText ? (
          <Text className="hmi-metrics-bar__text">{value}</Text>
        ) : (
          <Title level={3} className="hmi-metrics-bar__value" style={{ margin: 0, color: color || HMI_DESIGN_TOKENS.TEXT_PRIMARY }}>
            {value}
          </Title>
        )}
      </div>
    </div>
  );
}

export type HmiListItemProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

export function HmiListItem({ title, subtitle, selected, onClick, style }: HmiListItemProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={['hmi-list-item', selected ? 'hmi-list-item--selected' : undefined].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      style={{
        background: selected ? HMI_DESIGN_TOKENS.LIST_CARD_SELECTED_BG : HMI_DESIGN_TOKENS.LIST_CARD_BG,
        ...style,
      }}
    >
      <div className="hmi-list-item__title">{title}</div>
      {subtitle ? <div className="hmi-list-item__subtitle">{subtitle}</div> : null}
    </div>
  );
}
