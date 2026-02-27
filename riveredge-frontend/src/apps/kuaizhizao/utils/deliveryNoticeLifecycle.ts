/**
 * 发货单/送货单生命周期：待发送→已发送→已签收
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  待发送: '待发送',
  已发送: '已发送',
  已签收: '已签收',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '待发送';
  const keyMap: Record<string, string> = {
    待发送: 'pending',
    已发送: 'sent',
    已签收: 'signed',
  };
  const key = keyMap[stageName] ?? 'pending';
  const stageDefs = [
    { key: 'pending', label: '待发送' },
    { key: 'sent', label: '已发送' },
    { key: 'signed', label: '已签收' },
  ];
  const stageToIdx: Record<string, number> = { 待发送: 0, 已发送: 1, 已签收: 2 };
  const curIdx = stageToIdx[stageName] ?? 0;
  const mainStages = stageDefs.map((s, idx) => ({
    key: s.key,
    label: s.label,
    status: (idx < curIdx ? 'done' : idx === curIdx ? 'active' : 'pending') as 'done' | 'active' | 'pending',
  }));
  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: stageName === '已签收' ? 'success' : stageName === '已发送' ? 'active' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '待发送' ? ['发送'] : stageName === '已发送' ? ['签收'] : [],
  };
}

export function getDeliveryNoticeLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
