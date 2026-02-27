/**
 * 发货通知生命周期：待发货→已通知→已出库
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  待发货: '待发货',
  已通知: '已通知',
  已出库: '已出库',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '待发货';
  const keyMap: Record<string, string> = {
    待发货: 'pending',
    已通知: 'notified',
    已出库: 'shipped',
  };
  const key = keyMap[stageName] ?? 'pending';
  const stageDefs = [
    { key: 'pending', label: '待发货' },
    { key: 'notified', label: '已通知' },
    { key: 'shipped', label: '已出库' },
  ];
  const stageToIdx: Record<string, number> = { 待发货: 0, 已通知: 1, 已出库: 2 };
  const curIdx = stageToIdx[stageName] ?? 0;
  const mainStages = stageDefs.map((s, idx) => ({
    key: s.key,
    label: s.label,
    status: (idx < curIdx ? 'done' : idx === curIdx ? 'active' : 'pending') as 'done' | 'active' | 'pending',
  }));
  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: stageName === '已出库' ? 'success' : stageName === '已通知' ? 'active' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '待发货' ? ['通知仓库'] : stageName === '已通知' ? ['出库'] : [],
  };
}

export function getShipmentNoticeLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
