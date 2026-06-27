/**
 * 生产计划生命周期：优先使用后端 record.lifecycle，无则前端兜底。
 * 业务主轴：草稿→已执行（审核由 record.audit 独立列展示）
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

const PRODUCTION_PLAN_STAGE_KEYS = new Set(['draft', 'executed', 'cancelled', 'audited']);

function isProductionPlanLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return [...keys].some((k) => PRODUCTION_PLAN_STAGE_KEYS.has(k));
}

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const MAIN_STAGE_KEYS = ['draft', 'executed'] as const;
const MAIN_STAGE_LABELS: Record<(typeof MAIN_STAGE_KEYS)[number], string> = {
  draft: '草稿',
  executed: '已执行',
};

function buildMainStages(currentKey: string): SubStage[] {
  const stageToIndex: Record<string, number> = {
    draft: 0,
    executed: 1,
    audited: 0,
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

function stripAuditFromResult(result: LifecycleResult): LifecycleResult {
  const mainStages = (result.mainStages ?? []).filter((s) => s.key !== 'audited');
  let stageName = result.stageName ?? '';
  if (stageName === '已审核') stageName = '草稿';
  return { ...result, mainStages, stageName };
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const executionStatus = norm(record?.execution_status as string);

  if (status === '已驳回' || status === 'rejected') {
    return {
      current_stage_key: 'draft',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('draft'),
      next_step_suggestions: ['重新编辑后再次提交审核'],
    };
  }

  if (status === '已取消' || status === 'cancelled') {
    return {
      current_stage_key: 'draft',
      current_stage_name: '已取消',
      status: 'exception',
      main_stages: buildMainStages('draft'),
      next_step_suggestions: [],
    };
  }

  if (executionStatus === '已执行' || status === '已执行' || executionStatus === 'executed') {
    return {
      current_stage_key: 'executed',
      current_stage_name: '已执行',
      status: 'success',
      main_stages: buildMainStages('executed'),
      next_step_suggestions: [],
    };
  }

  return {
    current_stage_key: 'draft',
    current_stage_name: '草稿',
    status: 'normal',
    main_stages: buildMainStages('draft'),
    next_step_suggestions: ['提交审核', '执行计划'],
  };
}

export interface ProductionPlanLike {
  status?: string;
  execution_status?: string;
  lifecycle?: unknown;
}

export function getProductionPlanLifecycle(
  record: ProductionPlanLike | Record<string, unknown> | null | undefined,
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isProductionPlanLifecycle(backend)) {
    return stripAuditFromResult(parseBackendLifecycle(backend));
  }
  return stripAuditFromResult(parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>)));
}
