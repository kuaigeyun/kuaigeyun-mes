/**
 * 需求计算生命周期：根据 computation_status 映射。
 * 阶段：进行中→完成/失败
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import { LIFECYCLE_DOCUMENT_ACTION_LABEL_KEYS as DA } from '../constants/lifecycleDocumentActionLabelKeys';

const DC = 'app.kuaizhizao.demandComputation';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  进行中: '进行中',
  计算中: '进行中',
  完成: '完成',
  失败: '失败',
};

const MAIN_STAGE_KEYS = ['running', 'completed'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  running: '进行中',
  completed: '完成',
};

const DEMAND_COMPUTATION_STAGE_I18N_BY_KEY: Record<string, string> = {
  running: `${DC}.statusInProgress`,
  completed: `${DC}.statusCompleted`,
};

const COMPLETED_NEXT_STEP_KEYS = [
  DA.workOrderFromDemandComputation,
  DA.purchaseRequisitionFromDemandComputation,
  DA.purchaseOrderFromDemandComputation,
] as const;

function buildMainStages(currentKey: string): SubStage[] {
  const stageToIndex: Record<string, number> = {
    进行中: 0,
    完成: 1,
    失败: 0,
  };
  const currentIdx = stageToIndex[currentKey] ?? 0;
  const isFailed = currentKey === '失败';
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isFailed) status = idx === 0 ? 'active' : 'pending';
    else if (currentKey === '完成') {
      status = 'done';
    } else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

function buildClientLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const computationStatus = norm(record?.computation_status as string);
  const stageName = (STATUS_TO_STAGE[computationStatus] ?? computationStatus) || '进行中';
  const key = stageName === '完成' ? 'completed' : 'running';

  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: stageName === '失败' ? 'exception' : stageName === '完成' ? 'success' : 'active',
    main_stages: buildMainStages(stageName),
    next_step_suggestions: [],
  };
}

function resolveDemandComputationNextStepKeys(record: Record<string, unknown>): string[] {
  const computationStatus = norm(record?.computation_status as string);
  const stageName = STATUS_TO_STAGE[computationStatus] ?? computationStatus;
  if (stageName === '进行中') return [`${DC}.lifecycleNextWaitComplete`];
  if (stageName === '完成') return [...COMPLETED_NEXT_STEP_KEYS];
  if (stageName === '失败') return [`${DC}.lifecycleNextRecalculate`];
  return [];
}

function finalizeDemandComputationLifecycle(
  result: LifecycleResult,
  record: Record<string, unknown>,
  t: LifecycleTranslateFn,
): LifecycleResult {
  const localized = applyLifecycleI18n(result, t, DEMAND_COMPUTATION_STAGE_I18N_BY_KEY, {});
  const nextStepKeys = resolveDemandComputationNextStepKeys(record);
  return {
    ...localized,
    nextStepSuggestions: nextStepKeys.map((key) => requireI18nText(t, key)),
  };
}

export interface DemandComputationLike {
  computation_status?: string;
  lifecycle?: unknown;
}

export function getDemandComputationLifecycle(
  record: DemandComputationLike | Record<string, unknown> | null | undefined,
  t: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  const rawRecord = record as Record<string, unknown>;
  if (backend?.main_stages?.length) {
    return finalizeDemandComputationLifecycle(parseBackendLifecycle(backend), rawRecord, t);
  }
  return finalizeDemandComputationLifecycle(
    parseBackendLifecycle(buildClientLifecycle(rawRecord)),
    rawRecord,
    t,
  );
}
