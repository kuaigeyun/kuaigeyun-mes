/**
 * 材料借用生命周期：待借出→已借出→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getMaterialBorrowLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待借出' },
    { key: 'borrowed', label: '已借出' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    待借出: 'pending',
    已借出: 'borrowed',
    已取消: 'cancelled',
  },
  nextStepSuggestions: {
    pending: ['确认借出'],
    borrowed: ['归还'],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['borrowed'],
});
