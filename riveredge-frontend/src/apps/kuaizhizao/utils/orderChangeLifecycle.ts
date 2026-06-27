import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { createLifecycleResolver } from './createLifecycleResolver';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.salesOrder';
const OC = 'app.kuaizhizao.salesOrderChange';

/** 列表 API / 钉住 Tab 使用的阶段键（业务主轴，审核态由 audit 列展示） */
export const ORDER_CHANGE_STAGE_LABELS = ['草稿', '已生效', '已驳回'] as const;

const ORDER_CHANGE_STAGE_I18N: Record<string, string> = {
  草稿: `${P}.lifecycleDraft`,
  已生效: `${P}.lifecycleEffective`,
  已驳回: `${P}.lifecycleRejected`,
};

const ORDER_CHANGE_STAGE_I18N_BY_KEY: Record<string, string> = {
  draft: `${P}.lifecycleDraft`,
  applied: `${P}.lifecycleEffective`,
  rejected: `${P}.lifecycleRejected`,
};

const baseResolver = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿', labelKey: `${P}.lifecycleDraft` },
    { key: 'applied', label: '已生效', labelKey: `${P}.lifecycleEffective` },
  ],
  statusToKey: {
    草稿: 'draft',
    DRAFT: 'draft',
    待审核: 'draft',
    PENDING_REVIEW: 'draft',
    已审核: 'draft',
    AUDITED: 'draft',
    已生效: 'applied',
    APPLIED: 'applied',
    已驳回: 'rejected',
    REJECTED: 'rejected',
  },
  exceptionKeys: ['rejected'],
  exceptionStageKey: 'draft',
  successKeys: ['applied'],
  nextStepSuggestions: {
    draft: ['提交审核'],
    applied: [],
    rejected: ['修改后重新提交'],
  },
  nextStepSuggestionKeys: {
    draft: [`${OC}.lifecycleNextSubmitReview`],
    applied: [],
    rejected: [`${OC}.lifecycleNextResubmit`],
  },
});

function buildAppliedLifecycleBackend(t?: LifecycleTranslateFn): BackendLifecycle {
  const label = (key: string, fallback: string) =>
    t && ORDER_CHANGE_STAGE_I18N_BY_KEY[key] ? t(ORDER_CHANGE_STAGE_I18N_BY_KEY[key]) : fallback;
  return {
    current_stage_key: 'applied',
    current_stage_name: label('applied', '已生效'),
    status: 'success',
    main_stages: [
      { key: 'draft', label: label('draft', '草稿'), status: 'done' },
      { key: 'applied', label: label('applied', '已生效'), status: 'active' },
    ],
    next_step_suggestions: [],
  };
}

export function getOrderChangeLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  if (record.applied_at) {
    return parseBackendLifecycle(buildAppliedLifecycleBackend(t));
  }
  const result = baseResolver(record, t);
  const mainStages = (result.mainStages ?? []).filter(
    (s) => s.key !== 'pending_review' && s.key !== 'audited',
  );
  return { ...result, mainStages };
}

export function buildOrderChangeLifecycleValueEnum(
  t?: LifecycleTranslateFn,
): Record<
  string,
  { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }
> {
  const statusByStage: Record<string, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    草稿: 'Default',
    已生效: 'Success',
    已驳回: 'Error',
  };
  return Object.fromEntries(
    ORDER_CHANGE_STAGE_LABELS.map((stage) => [
      stage,
      {
        text: t ? t(ORDER_CHANGE_STAGE_I18N[stage] ?? stage) : stage,
        status: statusByStage[stage] ?? 'Default',
      },
    ]),
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

export function isOrderChangeDraft(record: { status?: string } | null | undefined): boolean {
  if (!record) return false;
  return record.status === 'DRAFT' || record.status === '草稿';
}

export function isOrderChangePendingReview(record: { status?: string } | null | undefined): boolean {
  if (!record) return false;
  return record.status === 'PENDING_REVIEW' || record.status === '待审核';
}
