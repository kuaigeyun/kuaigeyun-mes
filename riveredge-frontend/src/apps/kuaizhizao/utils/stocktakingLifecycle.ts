/**
 * 成品盘点生命周期：草稿→盘点中→已完成→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getStocktakingLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿' },
    { key: 'in_progress', label: '盘点中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    盘点中: 'in_progress',
    in_progress: 'in_progress',
    已完成: 'completed',
    completed: 'completed',
    已取消: 'cancelled',
    cancelled: 'cancelled',
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  nextStepSuggestionKeys: {},
  successKeys: ['completed'],
});
