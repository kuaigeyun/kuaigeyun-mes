/**
 * 报工生命周期：待审核→已通过→已驳回
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  pending: '待审核',
  待审核: '待审核',
  approved: '已审核',
  已审核: '已审核',
  rejected: '已驳回',
  已驳回: '已驳回',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '待审核';
  const keyMap: Record<string, string> = { 待审核: 'pending', 已审核: 'approved', 已驳回: 'rejected' };
  const key = keyMap[stageName] ?? 'pending';
  const stageDefs = [
    { key: 'pending', label: '待审核' },
    { key: 'approved', label: '已审核' },
    { key: 'rejected', label: '已驳回' },
  ];
  const stageToIdx: Record<string, number> = { 待审核: 0, 已审核: 1, 已驳回: 0 };
  const curIdx = stageToIdx[stageName] ?? 0;
  const isException = stageName === '已驳回';
  const mainStages = stageDefs.map((s, idx) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (isException) st = s.key === 'rejected' ? 'active' : 'pending';
    else if (idx < curIdx) st = 'done';
    else if (idx === curIdx) st = 'active';
    return { key: s.key, label: s.label, status: st };
  });
  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: isException ? 'exception' : stageName === '已审核' ? 'success' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '待审核' ? ['审核'] : [],
  };
}

export function getReportingLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
