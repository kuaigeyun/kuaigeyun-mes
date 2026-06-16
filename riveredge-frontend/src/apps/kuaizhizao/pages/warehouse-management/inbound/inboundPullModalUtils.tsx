import React from 'react';
import { Tag } from 'antd';
import type { TFunction } from 'i18next';

export function formatPullQty(val: unknown): string {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatPullPercent(done: unknown, total: unknown): string {
  const plan = Number(total || 0);
  const finished = Number(done || 0);
  if (!(plan > 0)) return '—';
  const pct = Math.min(100, Math.round((finished / plan) * 100));
  return `${formatPullQty(finished)} / ${formatPullQty(plan)}（${pct}%）`;
}

type LifecycleSubStage = { key?: string; label?: string; status?: string };

export function renderLifecycleSubStageTag(
  t: TFunction,
  subStages: LifecycleSubStage[] | undefined,
  stageKey: string,
): React.ReactNode {
  const stage = subStages?.find((s) => s.key === stageKey);
  if (!stage?.label) return <Tag>—</Tag>;
  const color = stage.status === 'done' ? 'success' : stage.status === 'active' ? 'processing' : 'default';
  const suffix =
    stage.status === 'done'
      ? t('app.kuaizhizao.warehouseInbound.pull.lifecycle.done')
      : stage.status === 'active'
        ? t('app.kuaizhizao.warehouseInbound.pull.lifecycle.active')
        : t('app.kuaizhizao.warehouseInbound.pull.lifecycle.pending');
  return <Tag color={color}>{`${stage.label}·${suffix}`}</Tag>;
}

export function renderPullableTag(
  t: TFunction,
  pullable: boolean | undefined,
  doneLabel?: string,
): React.ReactNode {
  if (pullable === false) {
    return <Tag color="default">{t('app.kuaizhizao.warehouseInbound.pull.noPullableQty')}</Tag>;
  }
  return <Tag color="success">{doneLabel ?? t('app.kuaizhizao.warehouseInbound.pull.pullable')}</Tag>;
}
