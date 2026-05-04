/**
 * 装箱绑定列表生命周期：绑定记录无审核流，展示「已绑定」完成态。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';

export function getPackingBindingLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  return {
    percent: 100,
    stageName: '已绑定',
    status: 'success',
    mainStages: [{ key: 'bound', label: '已绑定', status: 'done' }],
    nextStepSuggestions: [],
  };
}
