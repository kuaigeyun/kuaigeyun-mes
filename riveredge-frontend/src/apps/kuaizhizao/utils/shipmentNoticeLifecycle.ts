/**
 * 发货通知生命周期：待发货→已通知→已出库
 */

import { createLifecycleResolver } from './createLifecycleResolver';
import { requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const P = 'app.kuaizhizao.shipmentNotice';

export const SHIPMENT_NOTICE_LIFECYCLE_STAGE_LABELS = ['待发货', '已通知', '已出库'] as const;

const STAGE_I18N: Record<string, string> = {
  待发货: `${P}.statusPending`,
  已通知: `${P}.statusNotified`,
  已出库: `${P}.statusShipped`,
};

export const getShipmentNoticeLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_ship', label: '待发货', labelKey: `${P}.statusPending` },
    { key: 'notified', label: '已通知', labelKey: `${P}.statusNotified` },
    { key: 'shipped', label: '已出库', labelKey: `${P}.statusShipped` },
  ],
  statusToKey: {
    待发货: 'pending_ship',
    已通知: 'notified',
    已出库: 'shipped',
  },
  nextStepSuggestionKeys: {
    pending_ship: [`${P}.lifecycleNextNotifyWarehouse`, `${P}.lifecycleNextEditItems`],
    notified: [`${P}.lifecycleNextWithdrawNotify`, `${P}.lifecycleNextExecuteOutbound`],
    shipped: [],
  },
  successKeys: ['shipped'],
});

export function buildShipmentNoticeLifecycleValueEnum(
  t: LifecycleTranslateFn,
): Record<string, { text: string }> {
  return Object.fromEntries(
    SHIPMENT_NOTICE_LIFECYCLE_STAGE_LABELS.map((stage) => [
      stage,
      { text: requireI18nText(t, STAGE_I18N[stage]!) },
    ]),
  );
}

/** 列表 API 用 status 筛选；生命周期阶段与业务 status 一致 */
export function resolveShipmentNoticeListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...SHIPMENT_NOTICE_LIFECYCLE_STAGE_LABELS],
  });
  const api = toListLifecycleStageApiParams(stage);
  return api.lifecycle_stage ? { status: api.lifecycle_stage } : {};
}
