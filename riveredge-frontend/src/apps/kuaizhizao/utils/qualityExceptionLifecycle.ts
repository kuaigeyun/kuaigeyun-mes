/**
 * 质量异常生命周期：待处理→调查中→纠正中→已关闭 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getQualityExceptionLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'investigating', label: '调查中' },
    { key: 'correcting', label: '纠正中' },
    { key: 'closed', label: '已关闭' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    pending: 'pending',
    investigating: 'investigating',
    correcting: 'correcting',
    closed: 'closed',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    pending: ['调查'],
    investigating: ['纠正'],
    correcting: ['关闭'],
    closed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['closed'],
});
