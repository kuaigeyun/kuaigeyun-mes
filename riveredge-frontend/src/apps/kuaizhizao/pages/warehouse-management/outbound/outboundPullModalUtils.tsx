import { Tag } from 'antd';

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

export function renderPullableTag(pullable: boolean) {
  return pullable ? <Tag color="success">可取单</Tag> : <Tag>不可取单</Tag>;
}

export function renderLifecycleSubStageTag(label?: string) {
  if (!label) return null;
  return <Tag color="processing">{label}</Tag>;
}
