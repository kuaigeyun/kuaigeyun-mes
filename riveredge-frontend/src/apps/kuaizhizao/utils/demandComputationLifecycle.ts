/**
 * 需求计算生命周期：根据 computation_status 映射。
 * 阶段：进行中→完成/失败
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  进行中: '进行中',
  计算中: '进行中',
  完成: '完成',
  失败: '失败',
};

const MAIN_STAGE_KEYS = ['running', 'completed'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  running: '进行中',
  completed: '完成',
};

function buildMainStages(currentKey: string): SubStage[] {
  const stageToIndex: Record<string, number> = {
    进行中: 0,
    完成: 1,
    失败: 0,
  };
  const currentIdx = stageToIndex[currentKey] ?? 0;
  const isFailed = currentKey === '失败';
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isFailed) status = idx === 0 ? 'active' : 'pending';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const computationStatus = norm(record?.computation_status as string);
  const stageName = (STATUS_TO_STAGE[computationStatus] ?? computationStatus) || '进行中';
  const key = stageName === '完成' ? 'completed' : 'running';

  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: stageName === '失败' ? 'exception' : stageName === '完成' ? 'success' : 'active',
    main_stages: buildMainStages(stageName),
    next_step_suggestions: stageName === '进行中' ? ['等待计算完成'] : stageName === '完成' ? ['下推'] : stageName === '失败' ? ['重新计算'] : [],
  };
}

export interface DemandComputationLike {
  computation_status?: string;
  lifecycle?: unknown;
}

export function getDemandComputationLifecycle(
  record: DemandComputationLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
