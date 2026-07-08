import { createLifecycleResolver } from './createLifecycleResolver';
import { requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.salesReturn';

export const SALES_RETURN_LIFECYCLE_STAGE_LABELS = ['待退货', '已退货'] as const;

const STAGE_I18N: Record<string, string> = {
  待退货: `${P}.statusPending`,
  已退货: `${P}.statusReturned`,
};

export const getSalesReturnLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_return_goods', label: '待退货', labelKey: `${P}.statusPending` },
    { key: 'completed', label: '已退货', labelKey: `${P}.statusReturned` },
  ],
  statusToKey: {
    待退货: 'pending_return_goods',
    已退货: 'completed',
    草稿: 'pending_return_goods',
  },
  nextStepSuggestionKeys: {
    pending_return_goods: [`${P}.lifecycleNextConfirmReturn`],
    completed: [`${P}.lifecycleNextWithdrawConfirm`],
  },
  successKeys: ['completed'],
});

export function buildSalesReturnLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string }> {
  return Object.fromEntries(
    SALES_RETURN_LIFECYCLE_STAGE_LABELS.map((stage) => [
      stage,
      { text: requireI18nText(t, STAGE_I18N[stage]!) },
    ]),
  );
}

export function resolveSalesReturnListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...SALES_RETURN_LIFECYCLE_STAGE_LABELS],
  });
  const api = toListLifecycleStageApiParams(stage);
  return api.lifecycle_stage ? { status: api.lifecycle_stage } : {};
}
