/**
 * 生产计划生命周期：优先使用后端下发的 record.lifecycle，无则前端兜底。
 * 阶段：草稿→已审核→已执行，异常：已取消
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

const PRODUCTION_PLAN_STAGE_KEYS = new Set(['draft', 'audited', 'executed', 'cancelled']);

function isProductionPlanLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return [...keys].some((k) => PRODUCTION_PLAN_STAGE_KEYS.has(k));
}

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_KEY: Record<string, string> = {
  草稿: 'draft',
  已审核: 'audited',
  已执行: 'executed',
  已取消: 'cancelled',
  draft: 'draft',
  audited: 'audited',
  executed: 'executed',
  cancelled: 'cancelled',
};

const MAIN_STAGE_KEYS = ['draft', 'audited', 'executed'] as const;
const MAIN_STAGE_LABELS: Record<(typeof MAIN_STAGE_KEYS)[number], string> = {
  draft: '草稿',
  audited: '已审核',
  executed: '已执行',
};

function buildMainStages(currentKey: string): SubStage[] {
  const stageToIndex: Record<string, number> = {
    draft: 0,
    audited: 1,
    executed: 2,
    cancelled: 0,
  };
  const currentIdx = stageToIndex[currentKey] ?? 0;
  const isCompleted = currentKey === 'executed';
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompleted) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key], status };
  });
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const executionStatus = norm(record?.execution_status as string);
  let key = 'draft';
  if (executionStatus === '已执行' || status === '已执行') key = 'executed';
  else if (status === '已审核' || status === 'audited') key = 'audited';
  else if (status === '已驳回' || status === 'rejected') key = 'draft';
  else if (status === '草稿' || status === 'draft') key = 'draft';

  const labels: Record<string, string> = {
    draft: '草稿',
    audited: '已审核',
    executed: '已执行',
    cancelled: '已取消',
  };

  if (status === '已驳回' || status === 'rejected') {
    return {
      current_stage_key: 'draft',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('draft'),
      next_step_suggestions: ['重新编辑后再次提交审核'],
    };
  }

  if (key === 'cancelled' || status === '已取消') {
    return {
      current_stage_key: 'cancelled',
      current_stage_name: '已取消',
      status: 'exception',
      main_stages: buildMainStages('draft'),
      next_step_suggestions: [],
    };
  }

  const nextStepSuggestions: Record<string, string[]> = {
    draft: ['提交审核', '执行计划'],
    audited: ['执行计划'],
    executed: [],
  };

  return {
    current_stage_key: key,
    current_stage_name: (labels[key] ?? status) || '草稿',
    status: key === 'executed' ? 'success' : 'normal',
    main_stages: buildMainStages(key),
    next_step_suggestions: nextStepSuggestions[key] ?? [],
  };
}

export interface ProductionPlanLike {
  status?: string;
  execution_status?: string;
  lifecycle?: unknown;
}

/**
 * 根据生产计划获取生命周期结果，供 UniLifecycleStepper 使用。
 * 优先使用后端下发的 lifecycle；无则前端根据 status/execution_status 兜底。
 */
export function getProductionPlanLifecycle(
  record: ProductionPlanLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length && isProductionPlanLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
