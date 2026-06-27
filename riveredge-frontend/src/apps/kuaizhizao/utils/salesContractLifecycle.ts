/**
 * 销售合同生命周期（模式 A）：已生效 → 执行中 → 已完成 / 已关闭 / 已到期
 * 草稿/待审核/驳回仅由 record.audit +「审核状态」列展示，不在当前阶段出现。
 */

import { createLifecycleResolver } from './createLifecycleResolver';
import type { LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.salesContract';

export const SALES_CONTRACT_LIFECYCLE_STAGE_LABELS = [
  '已生效',
  '执行中',
  '已完成',
  '已关闭',
  '已到期',
] as const;

const STAGE_I18N: Record<string, string> = {
  已生效: `${P}.statusActive`,
  执行中: `${P}.statusExecuting`,
  已完成: `${P}.statusCompleted`,
  已关闭: `${P}.statusClosed`,
  已到期: `${P}.statusExpired`,
};

const baseResolver = createLifecycleResolver({
  stageDefs: [
    { key: 'effective', label: '已生效', labelKey: `${P}.statusActive` },
    { key: 'executing', label: '执行中', labelKey: `${P}.statusExecuting` },
    { key: 'finished', label: '已完成', labelKey: `${P}.statusCompleted` },
    { key: 'closed', label: '已关闭', labelKey: `${P}.statusClosed` },
  ],
  statusToKey: {
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
    effective: ['下推销售订单', '登记变更'],
    executing: ['查看回款', '关闭合同'],
    finished: [],
    closed: [],
  },
  nextStepSuggestionKeys: {
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

/** 合同列表 API 仍用 status 筛选；生命周期列筛选项对应业务 status */
export function resolveSalesContractListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...SALES_CONTRACT_LIFECYCLE_STAGE_LABELS, '已关闭'],
  });
  const stageToStatus: Record<string, string> = {
    已到期: '已到期',
  };
  const api = toListLifecycleStageApiParams(stage ? (stageToStatus[stage] ?? stage) : stage);
  return api.lifecycle_stage ? { status: api.lifecycle_stage } : {};
}
