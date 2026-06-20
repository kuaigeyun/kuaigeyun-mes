/**
 * 销售合同生命周期：草稿 → 待审核 → 已生效 → 执行中 → 已完成 / 已到期
 */

import { createLifecycleResolver } from './createLifecycleResolver';
import type { LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.salesContract';

export const SALES_CONTRACT_LIFECYCLE_STAGE_LABELS = [
  '草稿',
  '待审核',
  '已生效',
  '执行中',
  '已完成',
  '已关闭',
  '已到期',
] as const;

const STAGE_I18N: Record<string, string> = {
  草稿: `${P}.statusDraft`,
  待审核: `${P}.statusPending`,
  已生效: `${P}.statusActive`,
  执行中: `${P}.statusExecuting`,
  已完成: `${P}.statusCompleted`,
  已关闭: `${P}.statusClosed`,
  已到期: `${P}.statusExpired`,
};

const baseResolver = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿', labelKey: `${P}.statusDraft` },
    { key: 'pending_review', label: '待审核', labelKey: `${P}.statusPending` },
    { key: 'effective', label: '已生效', labelKey: `${P}.statusActive` },
    { key: 'executing', label: '执行中', labelKey: `${P}.statusExecuting` },
    { key: 'finished', label: '已完成', labelKey: `${P}.statusCompleted` },
    { key: 'closed', label: '已关闭', labelKey: `${P}.statusClosed` },
  ],
  statusToKey: {
    草稿: 'draft',
    DRAFT: 'draft',
    待审核: 'pending_review',
    PENDING_REVIEW: 'pending_review',
    已生效: 'effective',
    执行中: 'executing',
    已完成: 'finished',
    FINISHED: 'finished',
    已关闭: 'closed',
    CLOSED: 'closed',
    COMPLETED: 'finished',
    已到期: 'closed',
    EXPIRED: 'closed',
  },
  successKeys: ['finished'],
  nextStepSuggestions: {
    draft: ['保存并提交审核'],
    pending_review: ['审核通过', '驳回'],
    effective: ['下推销售订单', '登记变更'],
    executing: ['查看回款', '关闭合同'],
    finished: [],
    closed: [],
  },
  nextStepSuggestionKeys: {
    draft: [`${P}.lifecycleNextSubmit`],
    pending_review: [`${P}.lifecycleNextApprove`, `${P}.lifecycleNextReject`],
    effective: [`${P}.lifecycleNextReleaseOrder`, `${P}.lifecycleNextRegisterChange`],
    executing: [`${P}.lifecycleNextViewPayment`, `${P}.lifecycleNextCloseContract`],
    finished: [],
    closed: [],
  },
});

export const getSalesContractLifecycle = baseResolver;

export function buildSalesContractLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string }> {
  return Object.fromEntries(
    SALES_CONTRACT_LIFECYCLE_STAGE_LABELS.map((stage) => [
      stage,
      { text: t(STAGE_I18N[stage] ?? stage) },
    ]),
  );
}

/** 合同列表 API 仍用 status 筛选；UI 生命周期阶段名与 status 取值一致 */
export function resolveSalesContractListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...SALES_CONTRACT_LIFECYCLE_STAGE_LABELS, '已关闭'],
  });
  const stageToStatus: Record<string, string> = {};
  const api = toListLifecycleStageApiParams(stage ? (stageToStatus[stage] ?? stage) : stage);
  return api.lifecycle_stage ? { status: api.lifecycle_stage } : {};
}
