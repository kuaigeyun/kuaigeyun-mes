/**
 * 异常处理生命周期：待处理→处理中→已解决→已取消
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  pending: '待处理',
  待处理: '待处理',
  processing: '处理中',
  处理中: '处理中',
  resolved: '已解决',
  已解决: '已解决',
  cancelled: '已取消',
  已取消: '已取消',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const processStatus = norm(record?.process_status as string);
  const stageName = (STATUS_TO_STAGE[processStatus] ?? processStatus) || '待处理';
  const keyMap: Record<string, string> = { 待处理: 'pending', 处理中: 'processing', 已解决: 'resolved', 已取消: 'cancelled' };
  const key = keyMap[stageName] ?? 'pending';
  const stageDefs = [
    { key: 'pending', label: '待处理' },
    { key: 'processing', label: '处理中' },
    { key: 'resolved', label: '已解决' },
    { key: 'cancelled', label: '已取消' },
  ];
  const stageToIdx: Record<string, number> = { 待处理: 0, 处理中: 1, 已解决: 2, 已取消: 0 };
  const curIdx = stageToIdx[stageName] ?? 0;
  const isException = stageName === '已取消';
  const mainStages = stageDefs.map((s, idx) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (isException) st = s.key === 'cancelled' ? 'active' : 'pending';
    else if (idx < curIdx) st = 'done';
    else if (idx === curIdx) st = 'active';
    return { key: s.key, label: s.label, status: st };
  });
  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: isException ? 'exception' : stageName === '已解决' ? 'success' : stageName === '处理中' ? 'active' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '待处理' ? ['分配'] : stageName === '处理中' ? ['流转', '解决'] : [],
  };
}

export function getExceptionProcessLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
