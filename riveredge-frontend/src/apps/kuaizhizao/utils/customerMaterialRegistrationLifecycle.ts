/**
 * 代工来料生命周期：待入库→已入库 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.warehouseCommon';

export const getCustomerMaterialRegistrationLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_inbound', label: '待入库', labelKey: `${P}.statusPendingInbound` },
    { key: 'processed', label: '已入库', labelKey: `${P}.statusInbound` },
    { key: 'cancelled', label: '已取消', labelKey: `${P}.statusCancelled` },
  ],
  statusToKey: {
    pending: 'pending_inbound',
    processed: 'processed',
    cancelled: 'cancelled',
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  nextStepSuggestionKeys: {},
  successKeys: ['processed'],
});
