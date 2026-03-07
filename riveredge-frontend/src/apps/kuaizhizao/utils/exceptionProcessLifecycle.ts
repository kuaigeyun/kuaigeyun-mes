/**
 * 异常处理生命周期：待处理→处理中→已解决→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getExceptionProcessLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'processing', label: '处理中' },
    { key: 'resolved', label: '已解决' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    待处理: 'pending',
    pending: 'pending',
    处理中: 'processing',
    processing: 'processing',
    已解决: 'resolved',
    resolved: 'resolved',
    已取消: 'cancelled',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    pending: ['分配'],
    processing: ['流转', '解决'],
    resolved: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['resolved'],
  getStatus: (r) => (r?.process_status as string) ?? '',
});
