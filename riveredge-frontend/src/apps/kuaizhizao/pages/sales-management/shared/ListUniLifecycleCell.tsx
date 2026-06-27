import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import type { LifecycleResult } from '../../../../../components/uni-lifecycle/types';
import { translateLifecycleResult } from '../../../../../utils/globalLifecycleI18n';

/** 列表展示：active 节点 → stageName（含完结态）→ 最后一个 done 节点 */
export function resolveLifecycleDisplayLabel(lifecycle: LifecycleResult): string {
  const stages = lifecycle.mainStages ?? [];
  const active = stages.find((s) => s.status === 'active');
  if (active) return active.label;
  if (lifecycle.stageName) return lifecycle.stageName;
  return stages.filter((s) => s.status === 'done').at(-1)?.label ?? '-';
}

/** 列表「生命周期」列统一渲染（仅业务主轴，不含审核态） */
export function ListUniLifecycleCell({
  lifecycle,
  withSubStages = false,
}: {
  lifecycle: LifecycleResult;
  withSubStages?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const translated = useMemo(
    () => translateLifecycleResult(t, lifecycle),
    [lifecycle, t, i18n.language],
  );
  const displayLabel = resolveLifecycleDisplayLabel(translated);
  return (
    <UniLifecycle
      percent={translated.percent}
      stageName={displayLabel}
      status={translated.status}
      statusClass={translated.statusClass}
      flowClass={translated.flowClass}
      subStages={withSubStages ? translated.subStages : undefined}
      subPercent={translated.subPercent}
      subLabel={translated.subLabel}
      showLabel
      size="small"
      showCircleTooltip={false}
    />
  );
}
