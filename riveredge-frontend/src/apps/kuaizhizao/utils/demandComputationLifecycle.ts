/**
 * 需求计算生命周期：根据 computation_status 映射。
 * 阶段：待执行→计算中→完成/失败
 *
 * 「待执行」是新建后的静止态，须由计划员点执行推进；「计算中」才是运算期间的进行态。
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import { LIST_LIFECYCLE_STAGE_FIELD, resolveListLifecycleStageFromSearch } from '../../../utils/listLifecycleStage';
import { LIFECYCLE_DOCUMENT_ACTION_LABEL_KEYS as DA } from '../constants/lifecycleDocumentActionLabelKeys';

const DC = 'app.kuaizhizao.demandComputation';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  待执行: '待执行',
  计算中: '计算中',
  完成: '完成',
  失败: '失败',
};

const MAIN_STAGE_KEYS = ['pending', 'computing', 'completed'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  pending: '待执行',
  computing: '计算中',
  completed: '完成',
};

const DEMAND_COMPUTATION_STAGE_I18N_BY_KEY: Record<string, string> = {
  pending: `${DC}.statusPending`,
  computing: `${DC}.statusComputing`,
  completed: `${DC}.statusCompleted`,
};

const COMPLETED_NEXT_STEP_KEYS = [
  DA.workOrderFromDemandComputation,
  DA.purchaseRequisitionFromDemandComputation,
  DA.purchaseOrderFromDemandComputation,
] as const;

/** 失败发生在运算途中，故与「计算中」同一节点，仅整体状态转 exception */
const STAGE_NAME_TO_INDEX: Record<string, number> = {
  待执行: 0,
  计算中: 1,
  失败: 1,
  完成: 2,
};

function buildMainStages(currentStageName: string): SubStage[] {
  const currentIdx = STAGE_NAME_TO_INDEX[currentStageName] ?? 0;
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (currentStageName === '完成') status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

function buildClientLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const computationStatus = norm(record?.computation_status as string);
  const stageName = (STATUS_TO_STAGE[computationStatus] ?? computationStatus) || '待执行';
  const key =
    stageName === '完成' ? 'completed' : STAGE_NAME_TO_INDEX[stageName] === 1 ? 'computing' : 'pending';

  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status:
      stageName === '失败'
        ? 'exception'
        : stageName === '完成'
          ? 'success'
          : stageName === '计算中'
            ? 'active'
            : 'normal',
    main_stages: buildMainStages(stageName),
    next_step_suggestions: [],
  };
}

function resolveDemandComputationNextStepKeys(record: Record<string, unknown>): string[] {
  const computationStatus = norm(record?.computation_status as string);
  const stageName = STATUS_TO_STAGE[computationStatus] ?? computationStatus;
  if (stageName === '待执行') return [`${DC}.lifecycleNextExecute`];
  if (stageName === '计算中') return [`${DC}.lifecycleNextWaitComplete`];
  if (stageName === '完成') return [...COMPLETED_NEXT_STEP_KEYS];
  if (stageName === '失败') return [`${DC}.lifecycleNextRecalculate`];
  return [];
}

/** 展示名以 computation_status 为准：失败不是主轴节点，不能被活动节点名（计算中）冒充 */
const STAGE_NAME_I18N_BY_STATUS: Record<string, string> = {
  待执行: `${DC}.statusPending`,
  计算中: `${DC}.statusComputing`,
  完成: `${DC}.statusCompleted`,
  失败: `${DC}.statusFailed`,
};

function finalizeDemandComputationLifecycle(
  result: LifecycleResult,
  record: Record<string, unknown>,
  t: LifecycleTranslateFn,
): LifecycleResult {
  const localized = applyLifecycleI18n(result, t, DEMAND_COMPUTATION_STAGE_I18N_BY_KEY, {});
  const nextStepKeys = resolveDemandComputationNextStepKeys(record);
  const stageNameKey = STAGE_NAME_I18N_BY_STATUS[norm(record?.computation_status as string)];
  return {
    ...localized,
    ...(stageNameKey ? { stageName: requireI18nText(t, stageNameKey) } : {}),
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

const DEMAND_COMPUTATION_LIFECYCLE_STAGE_LABELS = ['待执行', '计算中', '完成', '失败'] as const;

const DEMAND_COMPUTATION_LIFECYCLE_STAGE_I18N: Record<string, string> = {
  待执行: `${DC}.statusPending`,
  计算中: `${DC}.statusComputing`,
  完成: `${DC}.statusCompleted`,
  失败: `${DC}.statusFailed`,
};

/** 列表筛选 / 钉住 Tab：与 computation_status 展示一致 */
export function getDemandComputationLifecycleStageLabels(): string[] {
  return [...DEMAND_COMPUTATION_LIFECYCLE_STAGE_LABELS];
}

export function buildDemandComputationLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }> {
  const statusByStage: Record<string, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    待执行: 'Default',
    计算中: 'Processing',
    完成: 'Success',
    失败: 'Error',
  };
  return Object.fromEntries(
    getDemandComputationLifecycleStageLabels().map((stage) => [
      stage,
      {
        text: requireI18nText(t, DEMAND_COMPUTATION_LIFECYCLE_STAGE_I18N[stage]!),
        status: statusByStage[stage] ?? 'Default',
      },
    ]),
  );
}

/** 从搜索表单 / 钉住条件解析列表筛选 */
export function resolveDemandComputationListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { computation_status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: DEMAND_COMPUTATION_LIFECYCLE_STAGE_LABELS,
  });
  if (!stage) return {};
  return { computation_status: stage };
}

export { LIST_LIFECYCLE_STAGE_FIELD } from '../../../utils/listLifecycleStage';
