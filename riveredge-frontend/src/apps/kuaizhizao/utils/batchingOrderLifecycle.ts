/**
 * 线边备料单生命周期：草稿→备料中→已完成→已取消
 * 状态码 picking / 历史中文「配料中」仍识别为备料中。
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const STATUS_TO_STAGE: Record<string, string> = {
  draft: '草稿',
  picking: '备料中',
  配料中: '备料中',
  备料中: '备料中',
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
    { key: 'picking', label: '备料中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    配料中: 'picking',
    备料中: 'picking',
    picking: 'picking',
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
