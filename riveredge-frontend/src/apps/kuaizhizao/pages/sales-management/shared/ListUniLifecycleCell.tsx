import React from 'react';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import type { LifecycleResult } from '../../../../../components/uni-lifecycle/types';

/** 列表展示：active 节点 → stageName（含完结态）→ 最后一个 done 节点 */
export function resolveLifecycleDisplayLabel(lifecycle: LifecycleResult): string {
  const stages = lifecycle.mainStages ?? [];
  const active = stages.find((s) => s.status === 'active');
  if (active) return active.label;
  if (lifecycle.stageName) return lifecycle.stageName;
  return stages.filter((s) => s.status === 'done').at(-1)?.label ?? '-';
}

/** 列表「生命周期」列统一渲染 */
export function ListUniLifecycleCell({
  lifecycle,
  withSubStages = false,
}: {
  lifecycle: LifecycleResult;
  withSubStages?: boolean;
}) {
  const displayLabel = resolveLifecycleDisplayLabel(lifecycle);
  return (
    <UniLifecycle
      percent={lifecycle.percent}
      stageName={displayLabel}
      status={lifecycle.status}
      subStages={withSubStages ? lifecycle.subStages : undefined}
      subPercent={lifecycle.subPercent}
      subLabel={lifecycle.subLabel}
      showLabel
      size="small"
      showCircleTooltip={false}
    />
  );
}
