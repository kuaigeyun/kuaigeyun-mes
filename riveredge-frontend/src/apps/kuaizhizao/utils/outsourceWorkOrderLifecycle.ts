/**
 * 工单委外生命周期：草稿→已下达→执行中→已完成→已取消
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  draft: '草稿',
  草稿: '草稿',
  released: '已下达',
  已下达: '已下达',
  in_progress: '执行中',
  执行中: '执行中',
  completed: '已完成',
  已完成: '已完成',
  cancelled: '已取消',
  已取消: '已取消',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '草稿';
  const keyMap: Record<string, string> = { 草稿: 'draft', 已下达: 'released', 执行中: 'in_progress', 已完成: 'completed', 已取消: 'cancelled' };
  const key = keyMap[stageName] ?? 'draft';
  const stageDefs = [
    { key: 'draft', label: '草稿' },
    { key: 'released', label: '已下达' },
    { key: 'in_progress', label: '执行中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ];
  const stageToIdx: Record<string, number> = { 草稿: 0, 已下达: 1, 执行中: 2, 已完成: 3, 已取消: 0 };
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
    status: isException ? 'exception' : stageName === '已完成' ? 'success' : stageName === '执行中' ? 'active' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '草稿' ? ['下达'] : stageName === '执行中' ? ['发料', '收货', '完成'] : [],
  };
}

export function getOutsourceWorkOrderLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
