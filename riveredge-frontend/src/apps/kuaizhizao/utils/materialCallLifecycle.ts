/**
 * 现场叫料生命周期：待处理→配料中→(部分送达)→已完成 / 已取消
 * 后端状态：pending / processing / partial / completed / cancelled
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getMaterialCallLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理' },
    { key: 'processing', label: '配料中' },
    { key: 'partial', label: '部分送达' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    pending: 'pending',
    processing: 'processing',
    partial: 'partial',
    completed: 'completed',
    cancelled: 'cancelled',
    /** 历史/错误前端曾用 picking，映射为 processing */
    picking: 'processing',
  },
  getStatus: (r) => {
    const s = String((r?.status as string) ?? '').trim();
    if (s === 'picking') return 'processing';
    return s;
  },
  nextStepSuggestions: {
    pending: ['开始配料'],
    processing: ['完成'],
    partial: ['完成'],
    completed: [],
    cancelled: [],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['completed'],
});
