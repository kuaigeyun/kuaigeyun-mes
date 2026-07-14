/**
 * 需求 lifecycle（模式 A）：业务主轴「已生效 → 已下推计算」；
 * 审核态由 record.audit + 列表「审核状态」列展示（预生效当前阶段为 —）。
 */

import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
} from '../../../utils/listLifecycleStage';
import { createLifecycleResolver } from './createLifecycleResolver';
import type { LifecycleTranslateFn } from './lifecycleI18n';
import { requireI18nText } from './lifecycleI18n';

const P = 'app.kuaizhizao.demandManagement';

const DEMAND_PLAN_LIFECYCLE_STAGE_LABELS = [
  '草稿',
  '待审核',
  '已驳回',
  '已生效',
  '已下推计算',
] as const;

const DEMAND_PLAN_LIFECYCLE_STAGE_I18N: Record<string, string> = {
  草稿: 'app.kuaizhizao.salesOrder.lifecycleDraft',
  待审核: 'app.kuaizhizao.salesOrder.lifecyclePendingReview',
  已驳回: 'app.kuaizhizao.salesOrder.lifecycleRejected',
  已生效: 'app.kuaizhizao.salesOrder.lifecycleEffective',
  已下推计算: `${P}.lifecyclePushed`,
};

export const getDemandLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'effective', label: '已生效', labelKey: 'app.kuaizhizao.salesOrder.lifecycleEffective' },
    { key: 'pushed', label: '已下推计算', labelKey: `${P}.lifecyclePushed` },
  ],
  statusToKey: {
    已生效: 'effective',
    effective: 'effective',
    已下推计算: 'pushed',
    pushed: 'pushed',
  },
  nextStepSuggestionKeys: {
    effective: [`${P}.suggestPushToComputation`],
    pushed: [],
  },
  successKeys: ['pushed'],
});

/** 列表筛选 / 钉住 Tab：与需求计划列表生命周期展示一致 */
export function getDemandPlanLifecycleStageLabels(): string[] {
  return [...DEMAND_PLAN_LIFECYCLE_STAGE_LABELS];
}

/** 供 ProColumns.valueEnum 与 uni-query 生命周期 Tab 使用 */
export function buildDemandPlanLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }> {
  const statusByStage: Record<string, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    草稿: 'Default',
    待审核: 'Processing',
    已驳回: 'Error',
    已生效: 'Success',
    已下推计算: 'Success',
  };
  return Object.fromEntries(
    getDemandPlanLifecycleStageLabels().map((stage) => [
      stage,
      {
        text: requireI18nText(t, DEMAND_PLAN_LIFECYCLE_STAGE_I18N[stage]!),
        status: statusByStage[stage] ?? 'Default',
      },
    ]),
  );
}

export type DemandListLifecycleApiParams = Partial<{
  status: string;
  review_status: string;
  pushed_to_computation: boolean;
}>;

/** 从搜索表单 / 钉住条件解析列表筛选（映射至现有 status / review_status / pushed_to_computation） */
/** 含历史钉住「已审核」→ 等价「已生效」 */
const DEMAND_PLAN_LIFECYCLE_STAGE_ALIASES = [
  ...DEMAND_PLAN_LIFECYCLE_STAGE_LABELS,
  '已审核',
] as const;

export function resolveDemandPlanListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): DemandListLifecycleApiParams {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: DEMAND_PLAN_LIFECYCLE_STAGE_ALIASES,
  });
  if (!stage) return {};
  switch (stage) {
    case '草稿':
      return { status: 'DRAFT' };
    case '待审核':
      return { status: 'PENDING_REVIEW' };
    case '已驳回':
      return { review_status: 'REJECTED' };
    case '已生效':
    case '已审核':
      return { review_status: 'APPROVED', pushed_to_computation: false };
    case '已下推计算':
      return { pushed_to_computation: true };
    default:
      return {};
  }
}

export { LIST_LIFECYCLE_STAGE_FIELD };
