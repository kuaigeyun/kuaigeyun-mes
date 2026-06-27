/**
 * 其他出库生命周期：待出库→已出库→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getOtherOutboundLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_outbound', label: '待出库' },
    { key: 'delivered', label: '已出库' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    待出库: 'pending_outbound',
    已出库: 'delivered',
    已取消: 'cancelled',
  },
  nextStepSuggestions: {
    pending_outbound: ['确认出库'],
    delivered: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['delivered'],
});
