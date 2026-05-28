import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { createLifecycleResolver } from './createLifecycleResolver';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

export const ORDER_CHANGE_STAGE_LABELS = ['草稿', '待审核', '已审核', '已生效', '已驳回'] as const;

const baseResolver = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿' },
    { key: 'pending_review', label: '待审核' },
    { key: 'audited', label: '已审核' },
    { key: 'applied', label: '已生效' },
  ],
  statusToKey: {
    草稿: 'draft',
    DRAFT: 'draft',
    待审核: 'pending_review',
    PENDING_REVIEW: 'pending_review',
    已审核: 'audited',
    AUDITED: 'audited',
    已生效: 'applied',
    APPLIED: 'applied',
    已驳回: 'rejected',
    REJECTED: 'rejected',
  },
  exceptionKeys: ['rejected'],
  exceptionStageKey: 'pending_review',
  successKeys: ['applied'],
  nextStepSuggestions: {
    draft: ['提交审核'],
    pending_review: ['审批通过', '驳回'],
    audited: ['生效回写'],
    applied: [],
    rejected: ['修改后重新提交'],
  },
});

export function getOrderChangeLifecycle(
  record: Record<string, unknown> | null | undefined,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  if (record.applied_at) {
    const backend: BackendLifecycle = {
      current_stage_key: 'applied',
      current_stage_name: '已生效',
      status: 'success',
      main_stages: [
        { key: 'draft', label: '草稿', status: 'done' },
        { key: 'pending_review', label: '待审核', status: 'done' },
        { key: 'audited', label: '已审核', status: 'done' },
        { key: 'applied', label: '已生效', status: 'active' },
      ],
      next_step_suggestions: [],
    };
    return parseBackendLifecycle(backend);
  }
  return baseResolver(record);
}

export function buildOrderChangeLifecycleValueEnum(): Record<
  string,
  { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }
> {
  const statusByStage: Record<string, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    草稿: 'Default',
    待审核: 'Processing',
    已审核: 'Warning',
    已生效: 'Success',
    已驳回: 'Error',
  };
  return Object.fromEntries(
    ORDER_CHANGE_STAGE_LABELS.map((stage) => [stage, { text: stage, status: statusByStage[stage] ?? 'Default' }]),
  );
}

export function resolveOrderChangeListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { lifecycle_stage?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...ORDER_CHANGE_STAGE_LABELS],
  });
  const keyMap: Record<string, string> = {
    草稿: 'draft',
    待审核: 'pending_review',
    已审核: 'audited',
    已生效: 'applied',
    已驳回: 'rejected',
  };
  const api = toListLifecycleStageApiParams(stage);
  if (api.lifecycle_stage && keyMap[api.lifecycle_stage]) {
    return { lifecycle_stage: keyMap[api.lifecycle_stage] };
  }
  return api;
}

export function isOrderChangeDraft(record: { status?: string; lifecycle?: BackendLifecycle } | null | undefined): boolean {
  if (!record) return false;
  const lc = getOrderChangeLifecycle(record as Record<string, unknown>);
  return lc.stageName === '草稿' || record.status === 'DRAFT' || record.status === '草稿';
}

export function isOrderChangePendingReview(record: { status?: string } | null | undefined): boolean {
  if (!record) return false;
  return record.status === 'PENDING_REVIEW' || record.status === '待审核';
}
