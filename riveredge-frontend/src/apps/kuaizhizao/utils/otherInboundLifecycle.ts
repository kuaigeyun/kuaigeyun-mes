/**
 * 其他入库生命周期：待入库→已入库→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.warehouseOtherInbound';

export const getOtherInboundLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_inbound', label: '待入库', labelKey: `${P}.status.pending` },
    { key: 'received', label: '已入库', labelKey: `${P}.status.posted` },
    { key: 'cancelled', label: '已取消', labelKey: `${P}.status.cancelled` },
  ],
  statusToKey: {
    待入库: 'pending_inbound',
    已入库: 'received',
    已取消: 'cancelled',
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  nextStepSuggestionKeys: {},
  successKeys: ['received'],
});
