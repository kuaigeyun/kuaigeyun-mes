import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LifecycleStageBadge } from '../../../../../components/uni-lifecycle';
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

/**
 * 列表「当前阶段」列统一渲染。
 * 唯一控制源：LifecycleStageBadge（徽章；无进度圆环；不含审核态）。
 */
export function ListUniLifecycleCell({
  lifecycle,
  withSubStages = false,
}: {
  lifecycle: LifecycleResult;
  /** 为 true 时徽章 hover 展示子阶段链路 */
  withSubStages?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const translated = useMemo(
    () => translateLifecycleResult(t, lifecycle),
    [lifecycle, t, i18n.language],
  );
  const displayLabel = resolveLifecycleDisplayLabel(translated);
  const subStages = withSubStages ? translated.subStages : undefined;

  return (
    <LifecycleStageBadge
      stageName={displayLabel}
      status={translated.status}
      percent={translated.percent}
      subStages={subStages}
      subLabel={translated.subLabel}
      subPercent={translated.subPercent}
      showTooltip={Boolean(subStages?.length)}
    />
  );
}
