import { renderPullQueryDocStatus } from '../../../../../components/uni-pull-query';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import type { TFunction } from 'i18next';

export function formatPullPercent(done: number, total: number): string {
  if (!(total > 0)) return '—';
  const pct = Math.min(100, Math.round((done / total) * 100));
  return `${pct}%`;
}

export function renderPullableTag(t: TFunction, pullable: boolean) {
  return pullable ? (
    <MarkerTag color="success">{t('app.kuaizhizao.warehouseOutbound.pull.pullable')}</MarkerTag>
  ) : (
    <MarkerTag color="default">{t('app.kuaizhizao.warehouseOutbound.pull.notPullable')}</MarkerTag>
  );
}

export function renderLifecycleSubStageTag(label?: string) {
  if (!label) return null;
  return <StatusTag color="processing">{label}</StatusTag>;
}

export function renderPullDocStatus(t: TFunction, value: unknown) {
  return renderPullQueryDocStatus(t, value);
}
