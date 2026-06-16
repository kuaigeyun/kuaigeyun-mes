/**
 * 质量异常生命周期：待处理→调查中→纠正中→已关闭 / 已取消
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.productionException';

export const getQualityExceptionLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待处理', labelKey: `${P}.lifecycle.pending` },
    { key: 'investigating', label: '调查中', labelKey: `${P}.lifecycle.investigating` },
    { key: 'correcting', label: '纠正中', labelKey: `${P}.lifecycle.correcting` },
    { key: 'closed', label: '已关闭', labelKey: `${P}.lifecycle.closed` },
    { key: 'cancelled', label: '已取消', labelKey: `${P}.lifecycle.cancelled` },
  ],
  statusToKey: {
    pending: 'pending',
    investigating: 'investigating',
    correcting: 'correcting',
    closed: 'closed',
    cancelled: 'cancelled',
  },
  nextStepSuggestions: {
    pending: ['调查'],
    investigating: ['纠正'],
    correcting: ['关闭'],
    closed: [],
    cancelled: [],
  },
  nextStepSuggestionKeys: {
    pending: [`${P}.lifecycleNext.investigate`],
    investigating: [`${P}.lifecycleNext.correct`],
    correcting: [`${P}.lifecycleNext.close`],
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  successKeys: ['closed'],
});
