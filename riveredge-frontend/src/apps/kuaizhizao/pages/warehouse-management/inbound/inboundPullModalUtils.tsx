import React from 'react';
import type { TFunction } from 'i18next';
import { renderPullQueryDocStatus } from '../../../../../components/uni-pull-query';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { formatQuantity } from '../../../../../utils/format';

export function formatPullPercent(done: unknown, total: unknown): string {
  const plan = Number(total || 0);
  const finished = Number(done || 0);
  if (!(plan > 0)) return '—';
  const pct = Math.min(100, Math.round((finished / plan) * 100));
  return `${formatQuantity(finished)} / ${formatQuantity(plan)}（${pct}%）`;
}

type LifecycleSubStage = { key?: string; label?: string; status?: string };

export function renderLifecycleSubStageTag(
  t: TFunction,
  subStages: LifecycleSubStage[] | undefined,
  stageKey: string,
): React.ReactNode {
  const stage = subStages?.find((s) => s.key === stageKey);
  if (!stage?.label) return '—';
  const color = stage.status === 'done' ? 'success' : stage.status === 'active' ? 'processing' : 'default';
  const suffix =
    stage.status === 'done'
      ? t('app.kuaizhizao.warehouseInbound.pull.lifecycle.done')
      : stage.status === 'active'
        ? t('app.kuaizhizao.warehouseInbound.pull.lifecycle.active')
        : t('app.kuaizhizao.warehouseInbound.pull.lifecycle.pending');
  return <StatusTag color={color}>{`${stage.label} ${suffix}`}</StatusTag>;
}

export function renderPullableTag(
  t: TFunction,
  pullable: boolean | undefined,
  doneLabel?: string,
): React.ReactNode {
  if (pullable === false) {
    return <MarkerTag color="default">{t('app.kuaizhizao.warehouseInbound.pull.noPullableQty')}</MarkerTag>;
  }
  return <MarkerTag color="success">{doneLabel ?? t('app.kuaizhizao.warehouseInbound.pull.pullable')}</MarkerTag>;
}

export function renderPullDocStatus(t: TFunction, value: unknown): React.ReactNode {
  return renderPullQueryDocStatus(t, value);
}
