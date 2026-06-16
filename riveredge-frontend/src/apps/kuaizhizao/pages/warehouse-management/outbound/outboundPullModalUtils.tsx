import { Tag } from 'antd';
import type { TFunction } from 'i18next';

export function formatPullQty(val: unknown): string {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatPullPercent(done: number, total: number): string {
  if (!(total > 0)) return '—';
  const pct = Math.min(100, Math.round((done / total) * 100));
  return `${pct}%`;
}

export function renderPullableTag(t: TFunction, pullable: boolean) {
  return pullable ? <Tag color="success">{t('app.kuaizhizao.warehouseOutbound.pull.pullable')}</Tag> : <Tag>{t('app.kuaizhizao.warehouseOutbound.pull.notPullable')}</Tag>;
}

export function renderLifecycleSubStageTag(label?: string) {
  if (!label) return null;
  return <Tag color="processing">{label}</Tag>;
}
