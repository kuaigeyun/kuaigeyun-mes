/**
 * 采购退货单生命周期：待退货 → 已退货；已取消为异常分支。
 */

import { createLifecycleResolver } from './createLifecycleResolver';
import { requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.purchaseReturn';

export const PURCHASE_RETURN_LIFECYCLE_STAGE_LABELS = ['待退货', '已退货'] as const;

const STAGE_I18N: Record<string, string> = {
  待退货: `${P}.statusPending`,
  已退货: `${P}.statusReturned`,
};

export const getPurchaseReturnLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_return_goods', label: '待退货', labelKey: `${P}.statusPending` },
    { key: 'done', label: '已退货', labelKey: `${P}.statusReturned` },
  ],
  statusToKey: {
    待退货: 'pending_return_goods',
    已退货: 'done',
    已取消: 'cancelled',
  },
  nextStepSuggestionKeys: {
    pending_return_goods: [],
    done: [],
  },
  successKeys: ['done'],
});

export function buildPurchaseReturnLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string }> {
  return Object.fromEntries(
    PURCHASE_RETURN_LIFECYCLE_STAGE_LABELS.map((stage) => [
      stage,
      { text: requireI18nText(t, STAGE_I18N[stage]!) },
    ]),
  );
}

export function resolvePurchaseReturnListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...PURCHASE_RETURN_LIFECYCLE_STAGE_LABELS],
  });
  const api = toListLifecycleStageApiParams(stage);
  return api.lifecycle_stage ? { status: api.lifecycle_stage } : {};
}

export { LIST_LIFECYCLE_STAGE_FIELD };

export interface PurchaseReturnLike {
  status?: string;
  lifecycle?: unknown;
}
