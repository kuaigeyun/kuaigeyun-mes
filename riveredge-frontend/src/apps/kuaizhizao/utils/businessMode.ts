/**
 * 需求 / 需求计算等业务模式（MTS / MTO / ATO）展示
 *
 * 列表「业务模式」列与需求计划一致：ProColumns.valueEnum + status，
 * 由 ProTable / UniTable 渲染为圆点状态徽章（非 MarkerTag / Tag）。
 */

export type DemandBusinessMode = 'MTS' | 'MTO' | 'ATO';

export function getDemandBusinessModeLabel(mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return '按库存生产';
  if (m === 'MTO') return '按订单生产';
  if (m === 'ATO') return '按订单组装 (ATO)';
  return m || '-';
}

/** Ant Design Tag color preset（详情抽屉等 Tag 展示） */
export function getDemandBusinessModeTagColor(mode: string | undefined | null): string {
  const m = (mode ?? '').trim();
  if (m === 'MTS') return 'processing';
  if (m === 'MTO') return 'success';
  if (m === 'ATO') return 'orange';
  return 'default';
}

type DemandBusinessModeValueEnum = Record<
  string,
  { text: string; status: 'Processing' | 'Success' | 'Warning' }
>;

/** 列表 valueEnum（圆点 + 文案），label 可传入 i18n */
export function buildDemandBusinessModeValueEnum(
  labelOf: (mode: DemandBusinessMode) => string = (mode) =>
    getDemandBusinessModeLabel(mode),
): DemandBusinessModeValueEnum {
  return {
    MTS: { text: labelOf('MTS'), status: 'Processing' },
    MTO: { text: labelOf('MTO'), status: 'Success' },
    ATO: { text: labelOf('ATO'), status: 'Warning' },
  };
}
