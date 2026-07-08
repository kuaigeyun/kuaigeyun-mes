/**
 * 收货通知生命周期：待收货→已通知→已入库
 */

import { createLifecycleResolver } from './createLifecycleResolver';
import { requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.receiptNotice';

export const RECEIPT_NOTICE_LIFECYCLE_STAGE_LABELS = ['待收货', '已通知', '已入库'] as const;

const STAGE_I18N: Record<string, string> = {
  待收货: `${P}.statusPendingReceipt`,
  已通知: 'app.kuaizhizao.shipmentNotice.statusNotified',
  已入库: `${P}.statusReceived`,
};

export const getReceiptNoticeLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_receive', label: '待收货', labelKey: `${P}.statusPendingReceipt` },
    { key: 'notified', label: '已通知', labelKey: 'app.kuaizhizao.shipmentNotice.statusNotified' },
    { key: 'received', label: '已入库', labelKey: `${P}.statusReceived` },
  ],
  statusToKey: {
    待收货: 'pending_receive',
    已通知: 'notified',
    已入库: 'received',
  },
  nextStepSuggestionKeys: {},
  successKeys: ['received'],
});

export function buildReceiptNoticeLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string }> {
  return Object.fromEntries(
    RECEIPT_NOTICE_LIFECYCLE_STAGE_LABELS.map((stage) => [
      stage,
      { text: requireI18nText(t, STAGE_I18N[stage]!) },
    ]),
  );
}

/** 列表 API 用 status 筛选；生命周期阶段与业务 status 一致 */
export function resolveReceiptNoticeListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...RECEIPT_NOTICE_LIFECYCLE_STAGE_LABELS],
  });
  const api = toListLifecycleStageApiParams(stage);
  return api.lifecycle_stage ? { status: api.lifecycle_stage } : {};
}

export { LIST_LIFECYCLE_STAGE_FIELD };
