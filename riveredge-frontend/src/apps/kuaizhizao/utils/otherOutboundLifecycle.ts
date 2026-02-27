/**
 * 其他出库生命周期：待出库→已出库→已取消
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  待出库: '待出库',
  已出库: '已出库',
  已取消: '已取消',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '待出库';
  const keyMap: Record<string, string> = { 待出库: 'pending', 已出库: 'delivered', 已取消: 'cancelled' };
  const key = keyMap[stageName] ?? 'pending';
  const stageDefs = [
    { key: 'pending', label: '待出库' },
    { key: 'delivered', label: '已出库' },
    { key: 'cancelled', label: '已取消' },
  ];
  const stageToIdx: Record<string, number> = { 待出库: 0, 已出库: 1, 已取消: 0 };
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
    status: isException ? 'exception' : stageName === '已出库' ? 'success' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '待出库' ? ['确认出库'] : [],
  };
}

export function getOtherOutboundLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
