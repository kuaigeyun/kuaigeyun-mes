/**
 * 工单生命周期：优先使用后端下发的 record.lifecycle，无则前端兜底。
 * 根据 record.status 映射到 mainStages，供 UniLifecycleStepper 展示。
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { WorkOrder } from '../types/production';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

/** 工单专用阶段 key 集合（与后端 document_lifecycle_service.WORK_ORDER_MAIN_STAGES 一致） */
const WORK_ORDER_STAGE_KEYS = new Set(['draft', 'released', 'in_progress', 'completed', 'cancelled']);

function isWorkOrderLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return keys.size === WORK_ORDER_STAGE_KEYS.size && [...keys].every((k) => WORK_ORDER_STAGE_KEYS.has(k));
}

const NORMAL_ORDER = ['draft', 'released', 'in_progress', 'completed'];

/** status 中英文映射到 key */
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

/** 前端兜底：根据 status 构建 BackendLifecycle */
function buildFallbackLifecycle(record: WorkOrder | Record<string, unknown>): BackendLifecycle {
  const status = (record?.status ?? (record as Record<string, unknown>).status) as string | undefined;
  const key = status ? (STATUS_TO_KEY[status] ?? 'draft') : 'draft';
  const labels: Record<string, string> = {
    draft: '草稿',
    released: '已下达',
    in_progress: '执行中',
    completed: '已完成',
    cancelled: '已取消',
  };
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
  const nextStepSuggestions: Record<string, string[]> = {
    draft: ['下达工单'],
    released: ['开始执行', '状态流转'],
    in_progress: ['报工', '指定结束', '状态流转'],
    completed: [],
    cancelled: [],
  };
  return {
    current_stage_key: key,
    current_stage_name: labels[key] ?? '-',
    status: key === 'cancelled' ? 'exception' : key === 'completed' ? 'success' : key === 'in_progress' ? 'active' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: nextStepSuggestions[key] ?? [],
  };
}

/**
 * 根据工单获取生命周期结果，供 UniLifecycleStepper 使用。
 * 优先使用后端下发的 lifecycle；无则前端根据 status 兜底。
 */
export function getWorkOrderLifecycle(
  record: WorkOrder | Record<string, unknown> | { status?: string; lifecycle?: unknown } | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isWorkOrderLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record));
}
