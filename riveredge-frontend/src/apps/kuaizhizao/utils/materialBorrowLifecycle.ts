/**
 * 材料借用生命周期：待借出→已借出→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getMaterialBorrowLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_borrow', label: '待借出', labelKey: 'app.kuaizhizao.materialBorrow.status.pending' },
    { key: 'borrowed', label: '已借出', labelKey: 'app.kuaizhizao.materialBorrow.status.borrowed' },
    { key: 'cancelled', label: '已取消', labelKey: 'app.kuaizhizao.materialBorrow.status.cancelled' },
  ],
  statusToKey: {
    待借出: 'pending_borrow',
    已借出: 'borrowed',
    已取消: 'cancelled',
  },
  nextStepSuggestions: {
    pending_borrow: ['确认借出'],
    borrowed: ['归还'],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['borrowed'],
});
