/**
 * 客户来料登记生命周期：待处理→已处理 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getCustomerMaterialRegistrationLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'processed', label: '已处理' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    pending: 'pending',
    processed: 'processed',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    pending: ['入库处理'],
    processed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['processed'],
});
