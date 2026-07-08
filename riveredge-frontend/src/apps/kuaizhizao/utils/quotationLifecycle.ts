/**
 * 报价单生命周期：后端 record.lifecycle 为唯一真源（模式 B，主轴不含审核节点）。
 */

import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';
import { createLifecycleResolver } from './createLifecycleResolver';
import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { LifecycleTranslateFn } from './lifecycleI18n';
import { requireI18nText } from './lifecycleI18n';

const P = 'app.kuaizhizao.quotation';

export const QUOTATION_LIFECYCLE_STAGE_KEYS = [
  'draft',
  'generated',
  'customer_confirmed',
  'converted',
] as const;

const QUOTATION_LIFECYCLE_STAGE_I18N: Record<string, string> = {
  草稿: `${P}.statusFilter.draft`,
  已报价: `${P}.statusFilter.sent`,
  客户确认: `${P}.statusFilter.accepted`,
  已转订单: `${P}.statusFilter.converted`,
  已驳回: `${P}.statusFilter.rejected`,
  下推单据已删除: `${P}.lifecycleDownstreamDeleted`,
};

/** 列表筛选 / 高级搜索：与生命周期主轴及异常态展示一致 */
export function getQuotationLifecycleStageLabels(): string[] {
  return ['草稿', '已报价', '客户确认', '已转订单', '已驳回', '下推单据已删除'];
}

export function buildQuotationLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string }> {
  return Object.fromEntries(
    getQuotationLifecycleStageLabels().map((stage) => [
      stage,
      { text: requireI18nText(t, QUOTATION_LIFECYCLE_STAGE_I18N[stage]!) },
    ]),
  );
}

/** 从搜索表单 / 钉住条件解析列表筛选；仅 lifecycle_stage */
export function resolveQuotationListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { lifecycle_stage?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: getQuotationLifecycleStageLabels(),
  });
  if (!stage) return {};
  return toListLifecycleStageApiParams(stage);
}

const baseResolver = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿', labelKey: `${P}.statusFilter.draft` },
    { key: 'generated', label: '已报价', labelKey: `${P}.statusFilter.sent` },
    { key: 'customer_confirmed', label: '客户确认', labelKey: `${P}.statusFilter.accepted` },
    { key: 'converted', label: '已转订单', labelKey: `${P}.statusFilter.converted` },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    DRAFT: 'draft',
    已发送: 'generated',
    sent: 'generated',
    已报价: 'generated',
    已接受: 'customer_confirmed',
    accepted: 'customer_confirmed',
    已转订单: 'converted',
    converted: 'converted',
  },
  nextStepSuggestionKeys: {},
  exceptionKeys: ['generated'],
  successKeys: ['converted'],
});

export interface QuotationLike {
  status?: string;
  review_status?: string;
  lifecycle?: unknown;
  conversion_downstream_missing?: boolean;
}

function applyQuotationLifecycleExtras(
  record: Record<string, unknown>,
  base: LifecycleResult,
  t: LifecycleTranslateFn,
): LifecycleResult {
  if (record.conversion_downstream_missing === true) {
    return {
      ...base,
      status: 'exception',
      stageName: requireI18nText(t, `${P}.lifecycleDownstreamDeleted`),
    };
  }
  return base;
}

export function getQuotationLifecycle(
  record: QuotationLike | Record<string, unknown> | null | undefined,
  _auditRequired = true,
  t: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const raw = record as Record<string, unknown>;
  const base = baseResolver(raw, t);
  return applyQuotationLifecycleExtras(raw, base, t);
}
