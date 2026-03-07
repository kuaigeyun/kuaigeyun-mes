/**
 * 配料单生命周期：草稿→配料中→已完成→已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const STATUS_TO_STAGE: Record<string, string> = {
  draft: '草稿',
  picking: '配料中',
  completed: '已完成',
  cancelled: '已取消',
};

export function getBatchingOrderStageName(status: string | undefined): string {
  if (!status) return '草稿';
  return STATUS_TO_STAGE[status] ?? status;
}

export const getBatchingOrderLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'draft', label: '草稿' },
    { key: 'picking', label: '配料中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    配料中: 'picking',
    picking: 'picking',
    已完成: 'completed',
    completed: 'completed',
    已取消: 'cancelled',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    draft: ['确认配料'],
    picking: ['完成配料'],
    completed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['completed'],
});
