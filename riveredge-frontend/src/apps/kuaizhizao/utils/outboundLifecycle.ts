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
    待领料: 'pending_picking',
    待出库: 'pending_delivery',
    待借出: 'pending_delivery',
    已确认: 'confirmed',
    confirmed: 'confirmed',
    已领料: 'completed',
    已出库: 'completed',
    已借出: 'completed',
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
