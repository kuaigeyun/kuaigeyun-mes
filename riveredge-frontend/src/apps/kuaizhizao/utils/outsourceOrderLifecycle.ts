/**
 * 工序委外生命周期：草稿→已下达→执行中→已完成→已取消
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
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
    next_step_suggestions: stageName === '草稿' ? ['下达'] : stageName === '执行中' ? ['收货', '完成'] : [],
  };
}

export function getOutsourceOrderLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}

const OUTSOURCE_ORDER_LIFECYCLE_KEYS = ['draft', 'released', 'in_progress', 'completed', 'cancelled'] as const;

const OUTSOURCE_ORDER_LIFECYCLE_I18N: Record<string, string> = {
  draft: 'app.kuaizhizao.outsourceOrder.statusDraft',
  released: 'app.kuaizhizao.outsourceOrder.statusReleased',
  in_progress: 'app.kuaizhizao.outsourceOrder.statusInProgress',
  completed: 'app.kuaizhizao.outsourceOrder.statusCompleted',
  cancelled: 'app.kuaizhizao.outsourceOrder.statusCancelled',
};

export function buildOutsourceOrderLifecycleValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Success' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Processing' | 'Success' | 'Error'> = {
    draft: 'Default',
    released: 'Processing',
    in_progress: 'Processing',
    completed: 'Success',
    cancelled: 'Error',
  };
  return Object.fromEntries(
    OUTSOURCE_ORDER_LIFECYCLE_KEYS.map((key) => [
      key,
      { text: t(OUTSOURCE_ORDER_LIFECYCLE_I18N[key]!), status: statusByKey[key] },
    ]),
  );
}

export function resolveOutsourceOrderListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
): { status?: string } {
  const raw = searchFormValues?.status ?? searchFormValues?.lifecycle_stage;
  if (raw == null || String(raw).trim() === '') return {};
  const status = String(raw).trim();
  if (OUTSOURCE_ORDER_LIFECYCLE_KEYS.includes(status as (typeof OUTSOURCE_ORDER_LIFECYCLE_KEYS)[number])) {
    return { status };
  }
  return {};
}
