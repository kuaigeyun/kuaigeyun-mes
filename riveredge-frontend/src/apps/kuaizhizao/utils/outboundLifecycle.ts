/**
 * 出库管理生命周期：草稿→已确认→已完成→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getOutboundLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿' },
    { key: 'confirmed', label: '已确认' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    已确认: 'confirmed',
    confirmed: 'confirmed',
    已完成: 'completed',
    completed: 'completed',
    已取消: 'cancelled',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    draft: ['确认'],
    confirmed: ['完成'],
    completed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['completed'],
});
