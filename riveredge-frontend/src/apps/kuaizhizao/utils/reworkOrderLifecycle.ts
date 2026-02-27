/**
 * 返工单生命周期：复用工单阶段，草稿→已下达→执行中→已完成→已取消
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

const REWORK_ORDER_STAGE_KEYS = new Set(['draft', 'released', 'in_progress', 'completed', 'cancelled']);

function isReworkOrderLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return [...keys].some((k) => REWORK_ORDER_STAGE_KEYS.has(k));
}

const STATUS_TO_KEY: Record<string, string> = {
  draft: 'draft',
  released: 'released',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  草稿: 'draft',
  已下达: 'released',
  执行中: 'in_progress',
  生产中: 'in_progress',
  已完成: 'completed',
  已取消: 'cancelled',
};

const NORMAL_ORDER = ['draft', 'released', 'in_progress', 'completed'];
const LABELS: Record<string, string> = {
  draft: '草稿',
  released: '已下达',
  in_progress: '执行中',
  completed: '已完成',
  cancelled: '已取消',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = (record?.status ?? '') as string;
  const key = status ? (STATUS_TO_KEY[status] ?? 'draft') : 'draft';
  const stageDefs = [
    { key: 'draft', label: '草稿' },
    { key: 'released', label: '已下达' },
    { key: 'in_progress', label: '执行中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ];
  const mainStages = stageDefs.map((s) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (key === 'cancelled') {
      st = s.key === 'cancelled' ? 'active' : 'pending';
    } else {
      const idx = NORMAL_ORDER.indexOf(s.key);
      const curIdx = NORMAL_ORDER.indexOf(key);
      if (s.key === key) st = 'active';
      else if (idx >= 0 && curIdx >= 0 && idx < curIdx) st = 'done';
    }
    return { key: s.key, label: s.label, status: st };
  });
  return {
    current_stage_key: key,
    current_stage_name: LABELS[key] ?? '-',
    status: key === 'cancelled' ? 'exception' : key === 'completed' ? 'success' : key === 'in_progress' ? 'active' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: key === 'draft' ? ['下达'] : key === 'released' || key === 'in_progress' ? ['报工', '完成'] : [],
  };
}

export interface ReworkOrderLike {
  status?: string;
  lifecycle?: unknown;
}

export function getReworkOrderLifecycle(
  record: ReworkOrderLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length && isReworkOrderLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
