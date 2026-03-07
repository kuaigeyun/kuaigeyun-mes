/**
 * 库存调拨生命周期：草稿→调拨中→已完成→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getInventoryTransferLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿' },
    { key: 'in_progress', label: '调拨中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    调拨中: 'in_progress',
    in_progress: 'in_progress',
    已完成: 'completed',
    completed: 'completed',
    已取消: 'cancelled',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    draft: ['执行调拨'],
    in_progress: ['完成'],
    completed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['completed'],
});
