/**
 * 库存预警记录生命周期：待处理→处理中→已解决 / 已忽略
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getInventoryAlertLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'processing', label: '处理中' },
    { key: 'resolved', label: '已解决' },
    { key: 'ignored', label: '已忽略' },
  ],
  statusToKey: {
    pending: 'pending',
    processing: 'processing',
    resolved: 'resolved',
    ignored: 'ignored',
  },
  nextStepSuggestions: {
    pending: ['处理预警'],
    processing: ['完成处理'],
    resolved: [],
    ignored: [],
  },
  exceptionKeys: ['ignored'],
  exceptionStageKey: 'ignored',
  successKeys: ['resolved'],
});
