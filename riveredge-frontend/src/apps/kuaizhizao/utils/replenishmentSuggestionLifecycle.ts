/**
 * 补货建议生命周期：待处理→已处理 / 已忽略
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getReplenishmentSuggestionLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'processed', label: '已处理' },
    { key: 'ignored', label: '已忽略' },
  ],
  statusToKey: {
    pending: 'pending',
    processed: 'processed',
    ignored: 'ignored',
  },
  nextStepSuggestions: {
    pending: ['处理'],
    processed: [],
    ignored: [],
  },
  exceptionKeys: ['ignored'],
  exceptionStageKey: 'ignored',
  successKeys: ['processed'],
});
