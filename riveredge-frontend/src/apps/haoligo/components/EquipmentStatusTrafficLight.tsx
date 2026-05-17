import React from 'react';
import { Flex, Typography } from 'antd';
import {
  operationalStatusActiveBulb,
  operationalStatusTextColor,
  trafficLightBulbs,
  TRAFFIC_LIGHT_BULB_COLORS,
  type TrafficLightBulb,
} from '../utils/operationalStatusTrafficLight';

const HOUSING_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 5,
  padding: '8px 10px',
  borderRadius: 8,
  background: 'linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.18)',
  border: '1px solid #404040',
};

function Bulb({ color, active, size = 14 }: { color: TrafficLightBulb; active: boolean; size?: number }) {
  const palette = TRAFFIC_LIGHT_BULB_COLORS[color];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: active
          ? `radial-gradient(circle at 35% 30%, ${palette.on}, ${palette.on} 55%, ${palette.off} 100%)`
          : palette.off,
        boxShadow: active
          ? `0 0 10px 2px ${palette.glow}, inset 0 -2px 4px rgba(0,0,0,0.35)`
          : 'inset 0 2px 4px rgba(0,0,0,0.45)',
        border: active ? `1px solid ${palette.on}` : '1px solid #4a4a4a',
        transition: 'box-shadow 0.2s ease, background 0.2s ease',
      }}
    />
  );
}

/** 下拉菜单等场景用的单色状态点 */
export function StatusBulbDot({
  status,
  size = 8,
}: {
  status: string | null | undefined;
  size?: number;
}) {
  const active = operationalStatusActiveBulb(status);
  const color = active ? TRAFFIC_LIGHT_BULB_COLORS[active].on : '#8c8c8c';
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: active ? `0 0 4px ${TRAFFIC_LIGHT_BULB_COLORS[active].glow}` : undefined,
      }}
    />
  );
}

export type EquipmentStatusTrafficLightProps = {
  status: string | null | undefined;
  statusLabel: string;
  compact?: boolean;
  showLabel?: boolean;
  /**
   * horizontal：灯在左、文字在右
   * vertical：灯在上、文字在下
   * label-left：文字在左、灯在右（卡片右侧，文案加大加粗且随状态变色）
   */
  orientation?: 'horizontal' | 'vertical' | 'label-left';
};

const EquipmentStatusTrafficLight: React.FC<EquipmentStatusTrafficLightProps> = ({
  status,
  statusLabel,
  compact = false,
  showLabel = true,
  orientation = 'horizontal',
}) => {
  const active = operationalStatusActiveBulb(status);
  const bulbSize = compact ? 10 : 14;
  const housingStyle = compact ? { ...HOUSING_STYLE, padding: '5px 7px', gap: 3 } : HOUSING_STYLE;
  const labelLeft = orientation === 'label-left';

  const light = (
    <div style={housingStyle}>
      {trafficLightBulbs().map((bulb) => (
        <Bulb key={bulb} color={bulb} active={active === bulb} size={bulbSize} />
      ))}
    </div>
  );

  const label = showLabel ? (
    <Typography.Text
      strong={labelLeft}
      style={{
        fontSize: labelLeft ? (compact ? 15 : 18) : compact ? 12 : 13,
        fontWeight: labelLeft ? 700 : 400,
        lineHeight: 1.2,
        color: labelLeft ? operationalStatusTextColor(status) : undefined,
        maxWidth: orientation === 'vertical' ? 56 : labelLeft ? 72 : compact ? 72 : 100,
        textAlign: orientation === 'vertical' ? 'center' : labelLeft ? 'right' : undefined,
      }}
      ellipsis={{ tooltip: statusLabel }}
      type={labelLeft ? undefined : 'secondary'}
    >
      {statusLabel}
    </Typography.Text>
  ) : null;

  const content =
    labelLeft && label ? (
      <>
        {label}
        {light}
      </>
    ) : (
      <>
        {light}
        {label}
      </>
    );

  return (
    <Flex
      vertical={orientation === 'vertical'}
      align="center"
      gap={orientation === 'vertical' ? 6 : labelLeft ? 10 : compact ? 8 : 10}
      style={{ userSelect: 'none', flexShrink: 0 }}
    >
      {content}
    </Flex>
  );
};

export default EquipmentStatusTrafficLight;
