/**
 * 还料单生命周期：待归还→已归还 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getMaterialReturnLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_material_return', label: '待归还' },
    { key: 'returned', label: '已归还' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    待归还: 'pending_material_return',
    已归还: 'returned',
    已取消: 'cancelled',
  },
  nextStepSuggestions: {
    pending_material_return: ['确认归还'],
    returned: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['returned'],
});
