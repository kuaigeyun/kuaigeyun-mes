/** 设备运行状态 → 三色灯亮灯（工业 Andon：红停 / 黄警 / 绿运行） */
export type TrafficLightBulb = 'red' | 'yellow' | 'green';

const BULB_ORDER: TrafficLightBulb[] = ['red', 'yellow', 'green'];

export function operationalStatusActiveBulb(status: string | null | undefined): TrafficLightBulb | null {
  const key = (status || '').trim().toLowerCase();
  if (!key) return null;
  if (key === 'running') return 'green';
  if (key === 'standby' || key === 'repair' || key === 'upkeep' || key === 'maintenance' || key === '保养') {
    return 'yellow';
  }
  if (key === 'shutdown') return 'red';
  return null;
}

export function trafficLightBulbs(): TrafficLightBulb[] {
  return BULB_ORDER;
}

export const TRAFFIC_LIGHT_BULB_COLORS: Record<
  TrafficLightBulb,
  { on: string; glow: string; off: string }
> = {
  red: { on: '#ff4d4f', glow: 'rgba(255, 77, 79, 0.65)', off: '#3d2a2a' },
  yellow: { on: '#faad14', glow: 'rgba(250, 173, 20, 0.65)', off: '#3d3520' },
  green: { on: '#52c41a', glow: 'rgba(82, 196, 26, 0.65)', off: '#2a3d24' },
};

/** 状态文案颜色（与亮灯一致；未设置时为灰色） */
export function operationalStatusTextColor(status: string | null | undefined): string {
  const active = operationalStatusActiveBulb(status);
  return active ? TRAFFIC_LIGHT_BULB_COLORS[active].on : 'rgba(0, 0, 0, 0.45)';
}

/** 工作台等设备中文状态 → 环状图配色（与 Andon 语义一致） */
export const EQUIPMENT_STATUS_LABEL_ORDER = [
  '正常运行',
  '停机',
  '维修',
  '保养',
  '闲置备用',
  '未知',
] as const;

export const EQUIPMENT_STATUS_LABEL_CHART_COLORS: Record<
  (typeof EQUIPMENT_STATUS_LABEL_ORDER)[number],
  string
> = {
  正常运行: TRAFFIC_LIGHT_BULB_COLORS.green.on,
  停机: TRAFFIC_LIGHT_BULB_COLORS.red.on,
  维修: TRAFFIC_LIGHT_BULB_COLORS.yellow.on,
  保养: TRAFFIC_LIGHT_BULB_COLORS.yellow.on,
  闲置备用: '#1677ff',
  未知: 'rgba(0, 0, 0, 0.45)',
};
