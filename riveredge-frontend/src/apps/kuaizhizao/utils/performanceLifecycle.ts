/**
 * 绩效管理列表：汇总计算状态、配置类启用状态
 */

import { createLifecycleResolver } from './createLifecycleResolver';

/** 绩效汇总：待计算 → 已计算 → 已确认 */
export const getPerformanceSummaryLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_calculation', label: '待计算' },
    { key: 'calculated', label: '已计算' },
    { key: 'confirmed', label: '已确认' },
  ],
  statusToKey: {
    pending: 'pending_calculation',
    calculated: 'calculated',
    confirmed: 'confirmed',
    draft: 'pending_calculation',
  },
  nextStepSuggestions: {
    pending_calculation: ['计算绩效'],
    calculated: ['确认绩效'],
    confirmed: [],
  },
  successKeys: ['confirmed'],
});

/** 配置类 is_active / isActive：启用 / 停用 */
export const getPerformanceConfigActiveLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'active', label: '启用' },
    { key: 'inactive', label: '停用' },
  ],
  statusToKey: {
    active: 'active',
    inactive: 'inactive',
  },
  getStatus: (r) => {
    const row = r as Record<string, unknown>;
    const v = row.is_active !== undefined ? row.is_active : row.isActive;
    return v !== false && v !== 'false' ? 'active' : 'inactive';
  },
  nextStepSuggestions: {
    active: [],
    inactive: [],
  },
  exceptionKeys: ['inactive'],
  exceptionStageKey: 'inactive',
  successKeys: ['active'],
});
