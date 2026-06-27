/**
 * 其他入库生命周期：待入库→已入库→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getOtherInboundLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_inbound', label: '待入库' },
    { key: 'received', label: '已入库' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    待入库: 'pending_inbound',
    已入库: 'received',
    已取消: 'cancelled',
  },
  nextStepSuggestions: {
    pending_inbound: ['确认入库'],
    received: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['received'],
});
