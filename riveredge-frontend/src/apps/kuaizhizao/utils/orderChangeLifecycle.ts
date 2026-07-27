import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import { createLifecycleResolver } from './createLifecycleResolver';
import { requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.salesOrder';
const OC = 'app.kuaizhizao.salesOrderChange';

/** 列表 API / 钉住 Tab 使用的阶段键（业务主轴：待生效→已生效；审核态由 audit 列展示） */
export const ORDER_CHANGE_STAGE_LABELS = ['待生效', '已生效', '已驳回'] as const;

const ORDER_CHANGE_STAGE_I18N: Record<string, string> = {
  待生效: `${OC}.lifecyclePendingApply`,
  已生效: `${P}.lifecycleEffective`,
  已驳回: `${P}.lifecycleRejected`,
};

const ORDER_CHANGE_STAGE_I18N_BY_KEY: Record<string, string> = {
  pending_apply: `${OC}.lifecyclePendingApply`,
  applied: `${P}.lifecycleEffective`,
  rejected: `${P}.lifecycleRejected`,
};

const baseResolver = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_apply', label: '待生效', labelKey: `${OC}.lifecyclePendingApply` },
    { key: 'applied', label: '已生效', labelKey: `${P}.lifecycleEffective` },
  ],
  statusToKey: {
    草稿: 'pending_apply',
    DRAFT: 'pending_apply',
    待审核: 'pending_apply',
    PENDING_REVIEW: 'pending_apply',
    已审核: 'pending_apply',
    AUDITED: 'pending_apply',
    已生效: 'applied',
    APPLIED: 'applied',
    已驳回: 'rejected',
    REJECTED: 'rejected',
  },
  exceptionKeys: ['rejected'],
  exceptionStageKey: 'pending_apply',
  successKeys: ['applied'],
  nextStepSuggestionKeys: {
    pending_apply: [`${OC}.lifecycleNextSubmitReview`],
    applied: [],
    rejected: [`${OC}.lifecycleNextResubmit`],
  },
});

export function getOrderChangeLifecycle(
  record: Record<string, unknown> | null | undefined,
  t: LifecycleTranslateFn,
): LifecycleResult {
  return baseResolver(record, t);
}

export function buildOrderChangeLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<
  string,
  { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }
> {
  const statusByStage: Record<string, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    待生效: 'Processing',
    已生效: 'Success',
    已驳回: 'Error',
  };
  return Object.fromEntries(
    ORDER_CHANGE_STAGE_LABELS.map((stage) => [
      stage,
      {
        text: requireI18nText(t, ORDER_CHANGE_STAGE_I18N[stage]!),
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
    待生效: 'pending_apply',
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
