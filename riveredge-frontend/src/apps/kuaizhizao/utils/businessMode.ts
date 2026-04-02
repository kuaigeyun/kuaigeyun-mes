/**
 * 需求 / 需求计算等业务模式（MTS / MTO / ATO）展示
 */

export type DemandBusinessMode = 'MTS' | 'MTO' | 'ATO';

export function getDemandBusinessModeLabel(mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return '按库存生产';
  if (m === 'MTO') return '按订单生产';
  if (m === 'ATO') return '按订单组装 (ATO)';
  return m || '-';
}

/** Ant Design Tag color preset */
export function getDemandBusinessModeTagColor(mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return 'processing';
  if (m === 'MTO') return 'success';
  if (m === 'ATO') return 'orange';
  return 'default';
}
