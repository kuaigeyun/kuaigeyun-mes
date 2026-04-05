/**
 * 倒冲记录状态：待处理→已完成 / 失败 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getBackflushRecordLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'completed', label: '已完成' },
    { key: 'failed', label: '失败' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    pending: 'pending',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    pending: ['执行倒冲'],
    completed: [],
    failed: ['重试'],
    cancelled: [],
  },
  exceptionKeys: ['failed', 'cancelled'],
  successKeys: ['completed'],
});
