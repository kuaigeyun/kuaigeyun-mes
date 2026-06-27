/**
 * 报价单生命周期：后端 record.lifecycle 为唯一真源（模式 B，主轴不含审核节点）。
 */

import { createLifecycleResolver } from './createLifecycleResolver';
import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { LifecycleTranslateFn } from './lifecycleI18n';

const P = 'app.kuaizhizao.quotation';

export const QUOTATION_LIFECYCLE_STAGE_KEYS = [
  'draft',
  'generated',
  'customer_confirmed',
  'converted',
] as const;

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
  t?: LifecycleTranslateFn,
): LifecycleResult {
  let result = base;
  if (record.conversion_downstream_missing === true) {
    result = {
      ...result,
      status: 'warning',
      stageName: t
        ? t(`${P}.lifecycleDownstreamDeleted`)
        : '下推单据已删除',
    };
  }
  return result;
}

export function getQuotationLifecycle(
  record: QuotationLike | Record<string, unknown> | null | undefined,
  _auditRequired = true,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const raw = record as Record<string, unknown>;
  const base = baseResolver(raw, t);
  return applyQuotationLifecycleExtras(raw, base, t);
}
