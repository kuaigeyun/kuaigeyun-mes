/**
 * 安装执行单阶段步骤条
 */

import React, { useMemo } from 'react';
import { Steps } from 'antd';
import type { StepsProps } from 'antd';
import type { InstallExecutionStage } from '../services/install-execution';
import { formatInstallStageLabel } from './InstallExecutionFormModal';

type StepItemStatus = NonNullable<StepsProps['items']>[number]['status'];

function mapStageStepStatus(status: string): StepItemStatus {
  if (status === '已完成') return 'finish';
  if (status === '进行中') return 'process';
  return 'wait';
}

function sortStages(stages: InstallExecutionStage[]): InstallExecutionStage[] {
  return [...stages].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.stage_key).localeCompare(String(b.stage_key));
  });
}

export function resolveInstallStageCurrentIndex(stages: InstallExecutionStage[]): number {
  const sorted = sortStages(stages);
  const inProgressIdx = sorted.findIndex((s) => s.status === '进行中');
  if (inProgressIdx >= 0) return inProgressIdx;
  const pendingIdx = sorted.findIndex((s) => s.status === '待开始');
  if (pendingIdx >= 0) return pendingIdx;
  return Math.max(0, sorted.length - 1);
}

export const InstallExecutionStageSteps: React.FC<{
  stages?: InstallExecutionStage[] | null;
  style?: React.CSSProperties;
}> = ({ stages, style }) => {
  const sorted = useMemo(() => sortStages(stages ?? []), [stages]);

  const items = useMemo(
    () =>
      sorted.map((stage) => ({
        title: formatInstallStageLabel(stage.stage_key, stage.stage_name),
        description: stage.status,
        status: mapStageStepStatus(String(stage.status ?? '')),
      })),
    [sorted],
  );

  if (!items.length) {
    return null;
  }

  const current = resolveInstallStageCurrentIndex(sorted);

  return (
    <div style={{ overflowX: 'auto', padding: '4px 0', ...style }}>
      <Steps current={current} size="small" items={items} />
    </div>
  );
};

export default InstallExecutionStageSteps;
