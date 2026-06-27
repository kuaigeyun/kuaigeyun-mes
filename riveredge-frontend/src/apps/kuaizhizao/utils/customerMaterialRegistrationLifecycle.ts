/**
 * 代工来料生命周期：待入库→已入库 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getCustomerMaterialRegistrationLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_inbound', label: '待入库' },
    { key: 'processed', label: '已入库' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    pending: 'pending_inbound',
    processed: 'processed',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    pending_inbound: ['确认入库'],
    processed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['processed'],
});
